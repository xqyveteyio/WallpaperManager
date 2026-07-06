<template>
    <div class="home-view">
        <WallpaperCarousel :thumbs="wallpaperThumbnailSrcs" @selectWallpaper="onSelectWallpaper"
            :current_wallpaper="currentWallpaper" />
    </div>
</template>

<script setup lang="ts">
import WallpaperCarousel from '../components/WallpaperCarousel.vue';
import { ref, onMounted } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join, resolveResource } from '@tauri-apps/api/path';
import { BaseDirectory, exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { download } from '@tauri-apps/plugin-upload';

const currentWallpaper = ref<string>('')
const WALLPAPER_DOWNLOAD_DIR = 'wallpaper_downloads'
const WALLPAPER_ORIGINALS_DIR = `${WALLPAPER_DOWNLOAD_DIR}/originals`
const WALLPAPER_THUMBNAILS_DIR = `${WALLPAPER_DOWNLOAD_DIR}/thumbnails`
const THUMBNAIL_MAX_HEIGHT = 180

var SelectedWallpaperSource: object = {
    "name": "anime_bg",
    "description": "anime_bg",
    "author": "anime_bg",
    "last_update": "2026-07-02 10:00:00",
    "data": [
        "https://images4.alphacoders.com/135/thumb-1920-1357925.png",
        "https://images8.alphacoders.com/136/thumb-1920-1362046.png",
        "https://images7.alphacoders.com/101/thumb-1920-1012056.jpg",
        "https://images3.alphacoders.com/138/thumb-1920-1386673.jpg",
        "https://images2.alphacoders.com/140/thumb-1920-1407959.png",
        "https://images5.alphacoders.com/132/thumb-1920-1324025.jpeg",
        "https://images.alphacoders.com/129/thumb-1920-1293319.png",
        "https://images7.alphacoders.com/127/thumb-1920-1277360.jpg",
        "https://images4.alphacoders.com/140/thumb-1920-1409039.png",
        "https://images5.alphacoders.com/139/thumb-1920-1395932.jpg",
        "https://images4.alphacoders.com/140/thumb-1920-1401145.png"
    ]
}
const wallpaperThumbnailPaths = ref<string[]>([])
const wallpaperThumbnailSrcs = ref<string[]>([])
const wallpaperFilePaths = ref<string[]>([])

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
    return `${basename}.jpg`
}

const loadImage = (src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(`图片加载失败: ${src}`))
        image.src = src
    })
}

const createThumbnailData = async (sourceRelativePath: string) => {
    const sourceData = await readFile(sourceRelativePath, { baseDir: BaseDirectory.AppData })
    const objectUrl = URL.createObjectURL(new Blob([sourceData]))
    let image: HTMLImageElement
    try {
        image = await loadImage(objectUrl)
    } finally {
        URL.revokeObjectURL(objectUrl)
    }

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
        }, 'image/jpeg', 0.82)
    })

    return new Uint8Array(await blob.arrayBuffer())
}

const getWallpapers = async () => {
    await ensureAppDataDir(WALLPAPER_ORIGINALS_DIR)
    await ensureAppDataDir(WALLPAPER_THUMBNAILS_DIR)

    const appData = await appDataDir()

    for (const [index, url] of SelectedWallpaperSource.data.entries()) {
        const originalFilename = getWallpaperFilename(url, index)
        const thumbnailFilename = getThumbnailFilename(originalFilename)
        const originalRelativePath = `${WALLPAPER_ORIGINALS_DIR}/${originalFilename}`
        const thumbnailRelativePath = `${WALLPAPER_THUMBNAILS_DIR}/${thumbnailFilename}`
        const originalPath = await join(appData, originalRelativePath)
        const thumbnailPath = await join(appData, thumbnailRelativePath)

        try {
            if (!(await exists(originalRelativePath, { baseDir: BaseDirectory.AppData }))) {
                await download(url, originalPath)
            }

            if (!(await exists(thumbnailRelativePath, { baseDir: BaseDirectory.AppData }))) {
                const thumbnailData = await createThumbnailData(originalRelativePath)
                await writeFile(thumbnailRelativePath, thumbnailData, {
                    baseDir: BaseDirectory.AppData,
                })
            }

            wallpaperFilePaths.value[index] = originalPath
            wallpaperThumbnailPaths.value[index] = thumbnailPath
            wallpaperThumbnailSrcs.value[index] = convertFileSrc(thumbnailPath)
        } catch (error) {
            console.error('下载或处理壁纸失败:', url, error)
        }
    }
}

export const loadWallpaperSource = async (source: object) => {
    SelectedWallpaperSource = source
    await getWallpapers();
}

// onMounted(async () => {
//     await getWallpapers();
// })

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