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
        </div>
    </div>
</template>

<script setup lang="ts">
import { emit } from '@tauri-apps/api/event';
import { reactive } from 'vue';
import {
    MAIN_WINDOW_SETTINGS_EVENT,
    type MainWindowPosition,
    readMainWindowSettings,
    writeMainWindowSettings,
} from '../utils/window-settings';

const settings = reactive(readMainWindowSettings())

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
}

.settings-panel {
    width: min(420px, calc(100vw - 48px));
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
