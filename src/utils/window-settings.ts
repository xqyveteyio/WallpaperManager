export type MainWindowPosition = 'top' | 'center' | 'bottom'

export interface MainWindowSettings {
    position: MainWindowPosition
    alwaysOnTop: boolean
}

export const MAIN_WINDOW_SETTINGS_EVENT = 'main-window-settings-changed'
export const MAIN_WINDOW_SETTINGS_STORAGE_KEY = 'main-window-settings'

export const DEFAULT_MAIN_WINDOW_SETTINGS: MainWindowSettings = {
    position: 'center',
    alwaysOnTop: false,
}

export const readMainWindowSettings = (): MainWindowSettings => {
    const rawSettings = localStorage.getItem(MAIN_WINDOW_SETTINGS_STORAGE_KEY)
    if (!rawSettings) {
        return DEFAULT_MAIN_WINDOW_SETTINGS
    }

    try {
        const settings = JSON.parse(rawSettings) as Partial<MainWindowSettings>
        return {
            position: isMainWindowPosition(settings.position)
                ? settings.position
                : DEFAULT_MAIN_WINDOW_SETTINGS.position,
            alwaysOnTop: settings.alwaysOnTop ?? DEFAULT_MAIN_WINDOW_SETTINGS.alwaysOnTop,
        }
    } catch (error) {
        console.warn('读取主窗口设置失败:', error)
        return DEFAULT_MAIN_WINDOW_SETTINGS
    }
}

export const writeMainWindowSettings = (settings: MainWindowSettings) => {
    localStorage.setItem(MAIN_WINDOW_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

const isMainWindowPosition = (value: unknown): value is MainWindowPosition => {
    return value === 'top' || value === 'center' || value === 'bottom'
}
