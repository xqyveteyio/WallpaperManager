<template>
    <div class="settings-view">
        <div class="settings-panel">
            <h1>设置</h1>

            <section class="setting-group">
                <h2>主窗口位置</h2>
                <div class="position-options">
                    <button v-for="option in positionOptions" :key="option.value"
                        :class="{ active: settings.position === option.value }" type="button"
                        @click="setPosition(option.value)">
                        {{ option.label }}
                    </button>
                </div>
            </section>

            <section class="setting-group">
                <label class="switch-row">
                    <span>
                        <strong>始终置顶</strong>
                        <small>开启后主窗口会保持在其他窗口上方</small>
                    </span>
                    <input v-model="settings.alwaysOnTop" type="checkbox" @change="saveSettings" />
                </label>
            </section>

            <section class="setting-group">
                <div class="section-title-row">
                    <h2>壁纸源</h2>
                    <button class="add-source-button" type="button" @click="openAddSourceModal">
                        添加源
                    </button>
                </div>

                <div v-if="sources.length" class="source-list">
                    <div v-for="source in sources" :key="source.id" class="source-item">
                        <label class="source-select">
                            <input :checked="selectedSourceId === source.id" name="wallpaper-source" type="radio"
                                @change="selectSource(source)" />
                        </label>

                        <div class="source-meta">
                            <strong>{{ source.name }}</strong>
                            <template v-if="isFavoritesSource(source)">
                                <p>收藏数量: {{ source.data.length }}</p>
                                <small>上次更改: {{ formatLastChangedAt(source.lastChangedAt) }}</small>
                            </template>
                            <template v-else>
                                <p>{{ source.description || '无描述' }}</p>
                                <small>作者: {{ source.author || '未知' }} · 更新: {{ source.last_update || '未知' }}</small>
                                <small>上次同步: {{ formatLastSyncedAt(source.lastSyncedAt) }}</small>
                            </template>
                        </div>

                        <div v-if="!isFavoritesSource(source)" class="source-actions">
                            <button type="button" :disabled="loadingSourceId === source.id" @click="syncSource(source)">
                                {{ loadingSourceId === source.id ? '同步中' : '同步' }}
                            </button>
                            <button class="danger" type="button" @click="deleteSource(source)">
                                删除
                            </button>
                        </div>
                    </div>
                </div>

                <p v-else class="empty-source">还没有壁纸源，点击“添加源”导入一个在线 JSON。</p>
            </section>
        </div>

        <div v-if="isAddSourceModalOpen" class="modal-mask" @click.self="closeAddSourceModal">
            <div class="modal">
                <h2>添加壁纸源</h2>
                <label>
                    <span>源 URL</span>
                    <input v-model.trim="sourceUrl" placeholder="https://example.com/wallpapers.json" type="url" />
                </label>
                <p v-if="sourceError" class="source-error">{{ sourceError }}</p>
                <div class="modal-actions">
                    <button type="button" @click="closeAddSourceModal">取消</button>
                    <button type="button" :disabled="isAddingSource || !sourceUrl" @click="addSource">
                        {{ isAddingSource ? '添加中' : '添加' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import {
    MAIN_WINDOW_SETTINGS_EVENT,
    type MainWindowPosition,
    readMainWindowSettings,
    writeMainWindowSettings,
} from '../utils/window-settings';
import {
    FAVORITES_SOURCE_ID,
    fetchWallpaperSource,
    readSelectedWallpaperSourceId,
    readWallpaperSources,
    syncWallpaperSourceIfStale,
    upsertWallpaperSource,
    WALLPAPER_SOURCES_CHANGED_EVENT,
    WALLPAPER_SOURCE_SELECTED_EVENT,
    type WallpaperSource,
    writeSelectedWallpaperSourceId,
    writeWallpaperSources,
} from '../utils/wallpaper-sources';

const settings = reactive(readMainWindowSettings())
const sources = ref<WallpaperSource[]>(readWallpaperSources())
const selectedSourceId = ref(readSelectedWallpaperSourceId() ?? sources.value[0]?.id ?? null)
const isAddSourceModalOpen = ref(false)
const isAddingSource = ref(false)
const sourceUrl = ref('')
const sourceError = ref('')
const loadingSourceId = ref<string | null>(null)
let unlistenSourcesChanged: UnlistenFn | null = null

const positionOptions: Array<{ label: string, value: MainWindowPosition }> = [
    { label: '靠上', value: 'top' },
    { label: '居中', value: 'center' },
    { label: '靠下', value: 'bottom' },
]

const saveSettings = async () => {
    writeMainWindowSettings(settings)
    await emit(MAIN_WINDOW_SETTINGS_EVENT, { ...settings })
}

const setPosition = async (position: MainWindowPosition) => {
    settings.position = position
    await saveSettings()
}

const openAddSourceModal = () => {
    sourceUrl.value = ''
    sourceError.value = ''
    isAddSourceModalOpen.value = true
}

const closeAddSourceModal = () => {
    if (isAddingSource.value) {
        return
    }

    isAddSourceModalOpen.value = false
}

const addSource = async () => {
    if (!sourceUrl.value) {
        return
    }

    isAddingSource.value = true
    sourceError.value = ''

    try {
        const wasEmpty = sources.value.length === 0
        const source = await fetchWallpaperSource(sourceUrl.value)
        sources.value = upsertWallpaperSource(source)

        if (wasEmpty) {
            await selectSource(source)
        }

        isAddSourceModalOpen.value = false
    } catch (error) {
        sourceError.value = error instanceof Error ? error.message : String(error)
    } finally {
        isAddingSource.value = false
    }
}

const selectSource = async (source: WallpaperSource) => {
    const activatedSource = await syncWallpaperSourceIfStale(source)
    sources.value = upsertWallpaperSource(activatedSource)
    selectedSourceId.value = activatedSource.id
    writeSelectedWallpaperSourceId(activatedSource.id)
    await emit(WALLPAPER_SOURCE_SELECTED_EVENT, activatedSource)
}

const syncSource = async (source: WallpaperSource) => {
    loadingSourceId.value = source.id

    try {
        const syncedSource = await fetchWallpaperSource(source.url)
        sources.value = upsertWallpaperSource(syncedSource)

        if (selectedSourceId.value === syncedSource.id) {
            await emit(WALLPAPER_SOURCE_SELECTED_EVENT, syncedSource)
        }
    } catch (error) {
        console.error('同步壁纸源失败:', error)
    } finally {
        loadingSourceId.value = null
    }
}

const deleteSource = async (source: WallpaperSource) => {
    if (isFavoritesSource(source)) {
        return
    }

    sources.value = sources.value.filter((item) => item.id !== source.id)
    writeWallpaperSources(sources.value)

    if (selectedSourceId.value !== source.id) {
        return
    }

    const nextSource = sources.value[0] ?? null
    selectedSourceId.value = nextSource?.id ?? null
    writeSelectedWallpaperSourceId(selectedSourceId.value)
    await emit(WALLPAPER_SOURCE_SELECTED_EVENT, nextSource)
}

const formatLastSyncedAt = (value: string) => {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime()) || date.getTime() === 0) {
        return '从未'
    }

    return date.toLocaleString()
}

const formatLastChangedAt = (value?: string) => {
    if (!value) {
        return '从未'
    }

    return formatLastSyncedAt(value)
}

const isFavoritesSource = (source: WallpaperSource) => {
    return source.id === FAVORITES_SOURCE_ID
}

onMounted(async () => {
    unlistenSourcesChanged = await listen(WALLPAPER_SOURCES_CHANGED_EVENT, () => {
        sources.value = readWallpaperSources()
    })
})

onUnmounted(() => {
    unlistenSourcesChanged?.()
})
</script>

<style lang="scss" scoped>
.settings-view {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #1e1e1e;
    color: #fff;
    overflow: auto;
}

.settings-panel {
    width: min(860px, calc(100vw - 48px));
    max-height: calc(100vh - 48px);
    overflow: auto;
    padding: 28px;
    border-radius: 16px;
    background-color: #282828;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);

    h1 {
        margin-bottom: 24px;
        font-size: 28px;
    }
}

.setting-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);

    h2 {
        font-size: 16px;
        font-weight: 600;
    }
}

.section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.add-source-button {
    height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 9px;
    background-color: #ff692c;
    color: #fff;
    cursor: pointer;
}

.position-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    button {
        height: 40px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        background-color: #333;
        color: #fff;
        cursor: pointer;

        &.active {
            border-color: #ff692c;
            background-color: #ff692c;
        }
    }
}

.source-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.source-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background-color: rgba(255, 255, 255, 0.04);
}

.source-select {
    display: flex;
}

.source-meta {
    min-width: 0;

    strong,
    p,
    small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    p {
        margin: 6px 0;
        color: rgba(255, 255, 255, 0.72);
    }

    small {
        color: rgba(255, 255, 255, 0.56);
    }
}

.source-actions {
    display: flex;
    gap: 8px;

    button {
        height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 9px;
        background-color: #333;
        color: #fff;
        cursor: pointer;

        &:disabled {
            cursor: not-allowed;
            opacity: 0.55;
        }

        &.danger {
            border-color: rgba(255, 96, 96, 0.5);
            color: #ff8a8a;
        }
    }
}

.empty-source {
    color: rgba(255, 255, 255, 0.62);
}

.source-error {
    color: #ff8a8a;
}

.modal-mask {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background-color: rgba(0, 0, 0, 0.5);
}

.modal {
    width: min(460px, 100%);
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 16px;
    background-color: rgba(40, 40, 40, 0.92);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(18px);

    h2 {
        margin-bottom: 18px;
    }

    label {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    input {
        height: 40px;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        background-color: #1e1e1e;
        color: #fff;
    }
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;

    button {
        height: 36px;
        padding: 0 16px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 10px;
        background-color: #333;
        color: #fff;
        cursor: pointer;

        &:last-child {
            border-color: #ff692c;
            background-color: #ff692c;
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.55;
        }
    }
}

.switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;

    span {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    small {
        color: rgba(255, 255, 255, 0.62);
    }

    input {
        width: 42px;
        height: 22px;
        cursor: pointer;
    }
}
</style>
