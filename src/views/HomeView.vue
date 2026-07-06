<template>
    <div class="home-view">
        <WallpaperCarousel :thumbs="wallpaperThumbnailSrcs" :favorited="wallpaperFavoritedStates"
            @selectWallpaper="onSelectWallpaper"
            @favoriteWallpaper="onFavoriteWallpaper" :current_wallpaper="currentWallpaper" />
    </div>
</template>

<script setup lang="ts">
import WallpaperCarousel from '../components/WallpaperCarousel.vue';
import { ref, onMounted, onUnmounted } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { appDataDir, join, resolveResource } from '@tauri-apps/api/path';
import { BaseDirectory, exists, mkdir, readDir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { download } from '@tauri-apps/plugin-upload';
import {
    FAVORITES_SOURCE_ID,
    addFavoriteWallpaper,
    getFavoriteRelativePath,
    getSelectedWallpaperSource,
    readWallpaperSources,
    syncWallpaperSourceIfStale,
    WALLPAPER_SOURCE_SELECTED_EVENT,
    type WallpaperSource,
} from '../utils/wallpaper-sources';

const currentWallpaper = ref<string>('')
const WALLPAPER_DOWNLOAD_DIR = 'wallpaper_downloads'
const THUMBNAIL_MAX_HEIGHT = 180

let unlistenWallpaperSource: UnlistenFn | null = null
const SelectedWallpaperSource = ref<WallpaperSource | null>(null)
const wallpaperThumbnailPaths = ref<string[]>([])
const wallpaperThumbnailSrcs = ref<string[]>([])
const wallpaperFilePaths = ref<string[]>([])
const wallpaperOriginalRelativePaths = ref<string[]>([])
const wallpaperFavoritedStates = ref<boolean[]>([])

const setWallpaper = async (file_path: string) => {
    const isWindows = navigator.userAgent.toLowerCase().includes('windows')
    const command = isWindows
        ? Command.create('set-wallpaper-windows', [
            '/C',
            await resolveResource('scripts/windows.bat'),
            file_path,
        ])
        : Command.create('set-wallpaper-linux', [
            await resolveResource('scripts/fedora.sh'),
            file_path,
        ])

    const output = await command.execute()
    if (output.code !== 0) {
        throw new Error(`设置壁纸失败: ${output.stderr || output.stdout}`)
    }
}

const onSelectWallpaper = async (index: number) => {
    currentWallpaper.value = wallpaperThumbnailSrcs.value[index] ?? ''

    const filePath = wallpaperFilePaths.value[index]
    if (filePath) {
        await setWallpaper(filePath)
    }
}

const onFavoriteWallpaper = async (index: number) => {
    const originalRelativePath = wallpaperOriginalRelativePaths.value[index]
    if (!originalRelativePath) {
        return
    }

    if (wallpaperFavoritedStates.value[index]) {
        return
    }

    const favoritesSource = await addFavoriteWallpaper(originalRelativePath)
    wallpaperFavoritedStates.value[index] = true
    if (SelectedWallpaperSource.value?.id === FAVORITES_SOURCE_ID) {
        await loadWallpaperSource(favoritesSource)
    }
}

const ensureAppDataDir = async (dir: string) => {
    if (!(await exists(dir, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(dir, {
            baseDir: BaseDirectory.AppData,
            recursive: true,
        })
    }
}

const getWallpaperFilename = (url: string, index: number) => {
    try {
        const sourceFilename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
            .replace(/[^a-zA-Z0-9._-]/g, '-')

        if (sourceFilename) {
            return `${index}-${sourceFilename}`
        }
    } catch (error) {
        console.warn('解析壁纸文件名失败:', url, error)
    }

    return `${index}-wallpaper.jpg`
}

const getThumbnailFilename = (filename: string) => {
    const basename = filename.replace(/\.[^.]+$/, '')
    return `${basename}-thumb-h${THUMBNAIL_MAX_HEIGHT}-v3.png`
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const loadImage = (src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = async () => {
            try {
                await image.decode()
            } catch {
                // Some WebViews resolve onload after decode already; continue with the loaded image.
            }

            resolve(image)
        }
        image.onerror = () => reject(new Error(`图片加载失败: ${src}`))
        image.src = src
    })
}

const decodeImageData = async (sourceData: Uint8Array) => {
    const objectUrl = URL.createObjectURL(new Blob([sourceData]))
    try {
        return await loadImage(objectUrl)
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

const readCompleteImageData = async (sourceRelativePath: string) => {
    let lastError: unknown

    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const sourceData = await readFile(sourceRelativePath, { baseDir: BaseDirectory.AppData })
            await decodeImageData(sourceData)
            return sourceData
        } catch (error) {
            lastError = error
            await delay(150)
        }
    }

    throw new Error(`图片文件未完整可用: ${sourceRelativePath}, ${String(lastError)}`)
}

const downloadOriginalWallpaper = async (url: string, originalRelativePath: string, originalPath: string) => {
    const tempRelativePath = `${originalRelativePath}.download`
    const tempPath = `${originalPath}.download`

    if (await exists(tempRelativePath, { baseDir: BaseDirectory.AppData })) {
        await remove(tempRelativePath, { baseDir: BaseDirectory.AppData })
    }

    try {
        await download(url, tempPath)
        const sourceData = await readCompleteImageData(tempRelativePath)
        await writeFile(originalRelativePath, sourceData, { baseDir: BaseDirectory.AppData })
    } finally {
        if (await exists(tempRelativePath, { baseDir: BaseDirectory.AppData })) {
            await remove(tempRelativePath, { baseDir: BaseDirectory.AppData })
        }
    }
}

const createThumbnailData = async (sourceRelativePath: string) => {
    const sourceData = await readCompleteImageData(sourceRelativePath)
    const objectUrl = URL.createObjectURL(new Blob([sourceData]))

    try {
        const image = await loadImage(objectUrl)
        const scale = Math.min(THUMBNAIL_MAX_HEIGHT / image.naturalHeight, 1)
        const width = Math.max(1, Math.round(image.naturalWidth * scale))
        const height = Math.max(1, Math.round(image.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        if (!context) {
            throw new Error('无法创建缩略图 canvas')
        }

        context.drawImage(image, 0, 0, width, height)

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('生成缩略图失败'))
                }
            }, 'image/png')
        })

        return new Uint8Array(await blob.arrayBuffer())
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

const cleanupCachedFiles = async (dir: string, keepFilenames: Set<string>) => {
    const entries = await readDir(dir, { baseDir: BaseDirectory.AppData })

    await Promise.all(entries.map(async (entry) => {
        if (keepFilenames.has(entry.name)) {
            return
        }

        await remove(`${dir}/${entry.name}`, { baseDir: BaseDirectory.AppData })
    }))
}

const getOriginalFilename = (source: WallpaperSource, url: string, index: number) => {
    if (source.id === FAVORITES_SOURCE_ID) {
        return url.split('/').pop() ?? `${index}-wallpaper`
    }

    return getWallpaperFilename(url, index)
}

const getWallpapers = async (source: WallpaperSource) => {
    const sourceDir = `${WALLPAPER_DOWNLOAD_DIR}/${source.id}`
    const originalsDir = `${sourceDir}/originals`
    const thumbnailsDir = `${sourceDir}/thumbnails`

    await ensureAppDataDir(originalsDir)
    await ensureAppDataDir(thumbnailsDir)

    const appData = await appDataDir()
    const favoritedPaths = getFavoritedPathSet()
    const originalFilenames = new Set<string>()
    const thumbnailFilenames = new Set<string>()

    source.data.forEach((url, index) => {
        const originalFilename = getOriginalFilename(source, url, index)
        originalFilenames.add(originalFilename)
        thumbnailFilenames.add(getThumbnailFilename(originalFilename))
    })

    await cleanupCachedFiles(originalsDir, originalFilenames)
    await cleanupCachedFiles(thumbnailsDir, thumbnailFilenames)

    for (const [index, url] of source.data.entries()) {
        const originalFilename = getOriginalFilename(source, url, index)
        const thumbnailFilename = getThumbnailFilename(originalFilename)
        const originalRelativePath = source.id === FAVORITES_SOURCE_ID
            ? url
            : `${originalsDir}/${originalFilename}`
        const thumbnailRelativePath = `${thumbnailsDir}/${thumbnailFilename}`
        const originalPath = await join(appData, originalRelativePath)
        const thumbnailPath = await join(appData, thumbnailRelativePath)

        try {
            if (source.id !== FAVORITES_SOURCE_ID && !(await exists(originalRelativePath, { baseDir: BaseDirectory.AppData }))) {
                await downloadOriginalWallpaper(url, originalRelativePath, originalPath)
            }

            if (!(await exists(thumbnailRelativePath, { baseDir: BaseDirectory.AppData }))) {
                const thumbnailData = await createThumbnailData(originalRelativePath)
                await writeFile(thumbnailRelativePath, thumbnailData, {
                    baseDir: BaseDirectory.AppData,
                })
            }

            wallpaperFilePaths.value[index] = originalPath
            wallpaperOriginalRelativePaths.value[index] = originalRelativePath
            wallpaperFavoritedStates.value[index] = source.id === FAVORITES_SOURCE_ID
                || favoritedPaths.has(getFavoriteRelativePath(originalRelativePath))
            wallpaperThumbnailPaths.value[index] = thumbnailPath
            wallpaperThumbnailSrcs.value[index] = convertFileSrc(thumbnailPath)
        } catch (error) {
            console.error('下载或处理壁纸失败:', url, error)
        }
    }
}

const loadWallpaperSource = async (source: WallpaperSource) => {
    SelectedWallpaperSource.value = source
    currentWallpaper.value = ''
    wallpaperFilePaths.value = []
    wallpaperOriginalRelativePaths.value = []
    wallpaperFavoritedStates.value = []
    wallpaperThumbnailPaths.value = []
    wallpaperThumbnailSrcs.value = []
    await getWallpapers(source);
}

onMounted(async () => {
    const selectedSource = getSelectedWallpaperSource()
    if (selectedSource) {
        await loadWallpaperSource(await syncWallpaperSourceIfStale(selectedSource))
    }

    unlistenWallpaperSource = await listen<WallpaperSource | null>(WALLPAPER_SOURCE_SELECTED_EVENT, async (event) => {
        if (event.payload) {
            await loadWallpaperSource(await syncWallpaperSourceIfStale(event.payload))
            return
        }

        SelectedWallpaperSource.value = null
        currentWallpaper.value = ''
        wallpaperFilePaths.value = []
        wallpaperOriginalRelativePaths.value = []
        wallpaperFavoritedStates.value = []
        wallpaperThumbnailPaths.value = []
        wallpaperThumbnailSrcs.value = []
    })
})

const getFavoritedPathSet = () => {
    const favoritesSource = readWallpaperSources().find((source) => source.id === FAVORITES_SOURCE_ID)
    return new Set(favoritesSource?.data ?? [])
}

onUnmounted(() => {
    unlistenWallpaperSource?.()
})

</script>


<style lang="scss" scoped>
.home-view {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>