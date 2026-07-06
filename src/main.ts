import { createApp } from "vue";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { cursorPosition, getCurrentWindow, monitorFromPoint, primaryMonitor } from "@tauri-apps/api/window";
import "./style.css";
import App from "./App.vue";
import { router } from './router';
import { createTray } from './utils/tray';
import {
    MAIN_WINDOW_SETTINGS_EVENT,
    type MainWindowSettings,
    readMainWindowSettings,
} from './utils/window-settings';

createApp(App).use(router).mount("#app");

const disableDefaultInteractions = () => {
    document.addEventListener('contextmenu', (event) => event.preventDefault())
    document.addEventListener('copy', (event) => event.preventDefault())
    document.addEventListener('dragstart', (event) => event.preventDefault())
    document.addEventListener('dragover', (event) => event.preventDefault())
    document.addEventListener('drop', (event) => event.preventDefault())
}

const getWindowY = (
    position: MainWindowSettings['position'],
    monitorY: number,
    monitorHeight: number,
    windowHeight: number,
) => {
    if (position === 'top') {
        return monitorY
    }

    if (position === 'bottom') {
        return monitorY + monitorHeight - windowHeight
    }

    return monitorY + (monitorHeight - windowHeight) / 2
}

const applyMainWindowSettings = async (settings: MainWindowSettings) => {
    const appWindow = getCurrentWindow()
    const cursor = await cursorPosition()
    const monitor = await monitorFromPoint(cursor.x, cursor.y) ?? await primaryMonitor();
    if (!monitor) {
        return
    }

    const width = monitor.size.width / monitor.scaleFactor
    const height = 140
    const x = monitor.position.x / monitor.scaleFactor
    const monitorY = monitor.position.y / monitor.scaleFactor
    const monitorHeight = monitor.size.height / monitor.scaleFactor
    const y = getWindowY(settings.position, monitorY, monitorHeight, height)

    await appWindow.setAlwaysOnTop(settings.alwaysOnTop)
    await appWindow.setPosition(new LogicalPosition(x, y))
    await appWindow.setSize(new LogicalSize(width, height))
}

const setupMainWindow = async () => {
    // 子窗口(如 settings)也会加载 index.html 执行本文件，
    // 所以托盘和“关闭即隐藏”只在主窗口执行一次
    const appWindow = getCurrentWindow();
    if (appWindow.label !== 'main') {
        return
    }

    await createTray();
    await applyMainWindowSettings(readMainWindowSettings())

    await listen<MainWindowSettings>(MAIN_WINDOW_SETTINGS_EVENT, async (event) => {
        await applyMainWindowSettings(event.payload)
    })

    // 关闭主窗口时只隐藏，不退出；只有托盘的“退出”(destroy) 才真正退出
    await appWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await appWindow.hide();
    });
}

disableDefaultInteractions()
void setupMainWindow()