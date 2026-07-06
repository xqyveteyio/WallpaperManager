import { appDataDir, join } from '@tauri-apps/api/path';
import { emit } from '@tauri-apps/api/event';
import { BaseDirectory, exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { download } from '@tauri-apps/plugin-upload';

export interface WallpaperSourceData {
    name: string
    description: string
    author: string
    last_update: string
    data: string[]
}

export interface WallpaperSource extends WallpaperSourceData {
    id: string
    url: string
    lastSyncedAt: string
    kind?: 'remote' | 'favorites'
    lastChangedAt?: string
}

export const WALLPAPER_SOURCE_SELECTED_EVENT = 'wallpaper-source-selected'
export const WALLPAPER_SOURCES_CHANGED_EVENT = 'wallpaper-sources-changed'
export const FAVORITES_SOURCE_ID = 'favorites'
export const FAVORITES_ORIGINALS_DIR = `wallpaper_downloads/${FAVORITES_SOURCE_ID}/originals`
const WALLPAPER_SOURCE_DOWNLOAD_DIR = 'wallpaper_sources'
const WALLPAPER_SOURCES_STORAGE_KEY = 'wallpaper-sources'
const SELECTED_WALLPAPER_SOURCE_ID_STORAGE_KEY = 'selected-wallpaper-source-id'
const SOURCE_SYNC_INTERVAL = 24 * 60 * 60 * 1000

export const readWallpaperSources = (): WallpaperSource[] => {
    const rawSources = localStorage.getItem(WALLPAPER_SOURCES_STORAGE_KEY)
    if (!rawSources) {
        return [createDefaultFavoritesSource()]
    }

    try {
        const sources = JSON.parse(rawSources) as unknown
        if (!Array.isArray(sources)) {
            return [createDefaultFavoritesSource()]
        }

        const parsedSources = sources
            .filter(isWallpaperSource)
            .map((source) => ({
                ...source,
                lastSyncedAt: source.lastSyncedAt || new Date(0).toISOString(),
                kind: source.kind ?? 'remote',
            }))
        const favoritesSource = parsedSources.find((source) => source.id === FAVORITES_SOURCE_ID)
            ?? createDefaultFavoritesSource()

        return [
            normalizeFavoritesSource(favoritesSource),
            ...parsedSources.filter((source) => source.id !== FAVORITES_SOURCE_ID),
        ]
    } catch (error) {
        console.warn('读取壁纸源失败:', error)
        return [createDefaultFavoritesSource()]
    }
}

export const writeWallpaperSources = (sources: WallpaperSource[]) => {
    localStorage.setItem(WALLPAPER_SOURCES_STORAGE_KEY, JSON.stringify(sources))
}

export const readSelectedWallpaperSourceId = () => {
    return localStorage.getItem(SELECTED_WALLPAPER_SOURCE_ID_STORAGE_KEY)
}

export const writeSelectedWallpaperSourceId = (id: string | null) => {
    if (id) {
        localStorage.setItem(SELECTED_WALLPAPER_SOURCE_ID_STORAGE_KEY, id)
    } else {
        localStorage.removeItem(SELECTED_WALLPAPER_SOURCE_ID_STORAGE_KEY)
    }
}

export const getSelectedWallpaperSource = () => {
    const sources = readWallpaperSources()
    const selectedId = readSelectedWallpaperSourceId()
    return sources.find((source) => source.id === selectedId) ?? sources[0] ?? null
}

export const fetchWallpaperSource = async (url: string): Promise<WallpaperSource> => {
    await ensureSourceDownloadDir()

    const id = createWallpaperSourceId(url)
    const relativePath = `${WALLPAPER_SOURCE_DOWNLOAD_DIR}/${id}.json`
    const filePath = await join(await appDataDir(), relativePath)

    await download(url, filePath)

    const sourceBytes = await readFile(relativePath, { baseDir: BaseDirectory.AppData })
    const sourceText = new TextDecoder().decode(sourceBytes)
    const source = JSON.parse(sourceText) as unknown
    const sourceData = normalizeWallpaperSourceData(source)

    return {
        ...sourceData,
        id,
        url,
        lastSyncedAt: new Date().toISOString(),
        kind: 'remote',
    }
}

export const syncWallpaperSourceIfStale = async (source: WallpaperSource) => {
    if (source.id === FAVORITES_SOURCE_ID) {
        return source
    }

    if (!isWallpaperSourceStale(source)) {
        return source
    }

    const syncedSource = await fetchWallpaperSource(source.url)
    upsertWallpaperSource(syncedSource)
    return syncedSource
}

export const addFavoriteWallpaper = async (sourceRelativePath: string) => {
    await ensureAppDataDir(FAVORITES_ORIGINALS_DIR)

    const filename = getFavoriteFilename(sourceRelativePath)
    const favoriteRelativePath = `${FAVORITES_ORIGINALS_DIR}/${filename}`
    const sourceData = await readFile(sourceRelativePath, { baseDir: BaseDirectory.AppData })
    await writeFile(favoriteRelativePath, sourceData, { baseDir: BaseDirectory.AppData })

    const sources = readWallpaperSources()
    const favoritesSource = normalizeFavoritesSource(
        sources.find((source) => source.id === FAVORITES_SOURCE_ID) ?? createDefaultFavoritesSource(),
    )

    if (!favoritesSource.data.includes(favoriteRelativePath)) {
        favoritesSource.data.push(favoriteRelativePath)
    }

    favoritesSource.lastChangedAt = new Date().toISOString()
    upsertWallpaperSource(favoritesSource)
    await emit(WALLPAPER_SOURCES_CHANGED_EVENT)

    return favoritesSource
}

export const getFavoriteRelativePath = (sourceRelativePath: string) => {
    return `${FAVORITES_ORIGINALS_DIR}/${getFavoriteFilename(sourceRelativePath)}`
}

export const upsertWallpaperSource = (source: WallpaperSource) => {
    const sources = readWallpaperSources()
    const existingIndex = sources.findIndex((item) => item.id === source.id)

    if (existingIndex === -1) {
        sources.push(source)
    } else {
        sources[existingIndex] = source
    }

    writeWallpaperSources(sources)
    return sources
}

const normalizeWallpaperSourceData = (value: unknown): WallpaperSourceData => {
    if (!isSourceRecord(value)) {
        throw new Error('壁纸源格式错误')
    }

    const data = value.data
    if (!Array.isArray(data) || !data.every((item) => typeof item === 'string')) {
        throw new Error('壁纸源 data 必须是图片 URL 数组')
    }

    return {
        name: readString(value.name, '未命名壁纸源'),
        description: readString(value.description, ''),
        author: readString(value.author, ''),
        last_update: readString(value.last_update, ''),
        data,
    }
}

const isWallpaperSource = (value: unknown): value is WallpaperSource => {
    if (!isSourceRecord(value)) {
        return false
    }

    return typeof value.id === 'string'
        && typeof value.url === 'string'
        && typeof value.name === 'string'
        && typeof value.description === 'string'
        && typeof value.author === 'string'
        && typeof value.last_update === 'string'
        && (typeof value.lastSyncedAt === 'string' || typeof value.lastSyncedAt === 'undefined')
        && (typeof value.kind === 'string' || typeof value.kind === 'undefined')
        && (typeof value.lastChangedAt === 'string' || typeof value.lastChangedAt === 'undefined')
        && Array.isArray(value.data)
        && value.data.every((item) => typeof item === 'string')
}

const isSourceRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null
}

const readString = (value: unknown, fallback: string) => {
    return typeof value === 'string' ? value : fallback
}

const isWallpaperSourceStale = (source: WallpaperSource) => {
    const lastSyncedAt = new Date(source.lastSyncedAt).getTime()
    if (!Number.isFinite(lastSyncedAt)) {
        return true
    }

    return Date.now() - lastSyncedAt > SOURCE_SYNC_INTERVAL
}

const createDefaultFavoritesSource = (): WallpaperSource => {
    return {
        id: FAVORITES_SOURCE_ID,
        url: 'favorites://local',
        kind: 'favorites',
        name: '收藏夹',
        description: '收藏的壁纸',
        author: 'local',
        last_update: '',
        lastSyncedAt: new Date(0).toISOString(),
        lastChangedAt: new Date(0).toISOString(),
        data: [],
    }
}

const normalizeFavoritesSource = (source: WallpaperSource): WallpaperSource => {
    return {
        ...createDefaultFavoritesSource(),
        ...source,
        id: FAVORITES_SOURCE_ID,
        url: 'favorites://local',
        kind: 'favorites',
        name: '收藏夹',
        description: '收藏的壁纸',
        author: 'local',
        lastChangedAt: source.lastChangedAt ?? new Date(0).toISOString(),
        data: Array.isArray(source.data) ? source.data : [],
    }
}

const ensureSourceDownloadDir = async () => {
    await ensureAppDataDir(WALLPAPER_SOURCE_DOWNLOAD_DIR)
}

const ensureAppDataDir = async (dir: string) => {
    if (!(await exists(dir, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(dir, {
            baseDir: BaseDirectory.AppData,
            recursive: true,
        })
    }
}

const createWallpaperSourceId = (url: string) => {
    let hash = 2166136261
    for (let index = 0; index < url.length; index += 1) {
        hash ^= url.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }

    return `source-${(hash >>> 0).toString(16)}`
}

const getFavoriteFilename = (sourceRelativePath: string) => {
    const sourceFilename = sourceRelativePath.split('/').pop() ?? 'wallpaper'
    return `${createPathHash(sourceRelativePath)}-${sourceFilename.replace(/[^a-zA-Z0-9._-]/g, '-')}`
}

const createPathHash = (value: string) => {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }

    return (hash >>> 0).toString(16)
}
