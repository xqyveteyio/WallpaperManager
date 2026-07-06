<template>
    <div class="settings-view">
        <section class="setting-group">
            <h2>壁纸轮盘位置</h2>
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
                    <span>始终置顶</span>
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
                        <span>{{ source.name }}</span>
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
    flex-direction: column;
    gap: 18px;
    padding: 26px;
    box-sizing: border-box;
    color: #1f2937;
    background: #fff;
    overflow: auto;
}

.setting-group {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    padding: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;

    h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: #111827;
    }
}

.section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.add-source-button {
    height: 36px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background-color: #ff692c;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.16s ease;

    &:hover {
        background-color: #ff692c;
    }
}

.position-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;

    button {
        height: 44px;
        border: 0;
        border-radius: 14px;
        background-color: #f8fafc;
        color: #475569;
        cursor: pointer;
        transition: color 0.16s ease, background-color 0.16s ease;

        &:hover {
            background-color: #fff7ed;
            color: #ff692c;
        }

        &.active {
            background-color: #fff5ef;
            color: #ff692c;
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
    padding: 12px 0;
    border-bottom: 1px solid #e2e8f0;
}

.source-select {
    display: flex;

    input {
        width: 18px;
        height: 18px;
        accent-color: #ff692c;
        cursor: pointer;
    }
}

.source-meta {
    min-width: 0;

    strong {
        color: #111827;
    }

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
        color: #64748b;
    }

    small {
        color: #94a3b8;
    }
}

.source-actions {
    display: flex;
    gap: 8px;

    button {
        height: 34px;
        padding: 0 12px;
        border: 0;
        border-radius: 10px;
        background-color: #f8fafc;
        color: #334155;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.16s ease, background-color 0.16s ease;
        font-weight: 500;

        &:hover:not(:disabled) {
            background-color: #fff7ed;
            color: #ff692c;
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.55;
        }

        &.danger {
            background-color: #fff5f5;
            color: #dc2626;


            &:hover {
                background-color: #fee2e2;
                color: #b91c1c;
            }
        }
    }
}

.empty-source {
    margin: 0;
    padding: 18px 0;
    color: #64748b;
    text-align: center;
}

.source-error {
    margin: 12px 0 0;
    color: #dc2626;
}

.modal-mask {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background-color: rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(8px);
}

.modal {
    width: min(460px, 100%);
    padding: 24px;
    border-radius: 14px;
    background-color: rgba(255, 255, 255, 0.96);

    h2 {
        margin-top: 0;
        margin-bottom: 18px;
        color: #111827;
    }

    label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: #475569;
        font-weight: 600;
    }

    input {
        height: 42px;
        padding: 0 12px;
        border: 0;
        border-radius: 12px;
        background-color: #f8fafc;
        color: #111827;
        outline: none;

        &::placeholder {
            color: #94a3b8;
        }
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
        border: 0;
        border-radius: 999px;
        background-color: #f8fafc;
        color: #475569;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.16s ease, background-color 0.16s ease;

        &:hover:not(:disabled) {
            background-color: #eef2f7;
            color: #111827;
        }

        &:last-child {
            background-color: #ff692c;
            color: #fff;

            &:hover:not(:disabled) {
                background-color: #f45e20;
                color: #fff;
            }
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
    padding: 4px 0;

    span {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    strong {
        color: #111827;
    }

    small {
        color: #64748b;
    }

    input {
        position: relative;
        width: 46px;
        height: 26px;
        flex: 0 0 auto;
        appearance: none;
        border-radius: 999px;
        background-color: #cbd5e1;
        cursor: pointer;
        transition: background-color 0.16s ease;

        &::after {
            content: "";
            position: absolute;
            top: 3px;
            left: 3px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: #fff;
            transition: transform 0.16s ease;
        }

        &:checked {
            background-color: #ff692c;
        }

        &:checked::after {
            transform: translateX(20px);
        }
    }
}
</style>
