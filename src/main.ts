import { createApp } from "vue";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { cursorPosition, getCurrentWindow, monitorFromPoint, primaryMonitor } from "@tauri-apps/api/window";
import "./style.css";
import App from "./App.vue";
import { router } from './router';
import { createTray } from './utils/tray';

createApp(App).use(router).mount("#app");

const disableDefaultInteractions = () => {
    document.addEventListener('contextmenu', (event) => event.preventDefault())
    document.addEventListener('copy', (event) => event.preventDefault())
    document.addEventListener('dragstart', (event) => event.preventDefault())
    document.addEventListener('dragover', (event) => event.preventDefault())
    document.addEventListener('drop', (event) => event.preventDefault())
}

const setupMainWindow = async () => {
    // 子窗口(如 settings)也会加载 index.html 执行本文件，
    // 所以托盘和“关闭即隐藏”只在主窗口执行一次
    const appWindow = getCurrentWindow();
    if (appWindow.label !== 'main') {
        return
    }

    await createTray();

    const cursor = await cursorPosition()
    const monitor = await monitorFromPoint(cursor.x, cursor.y) ?? await primaryMonitor();
    if (monitor) {
        const width = monitor.size.width / monitor.scaleFactor
        const height = 140
        const x = monitor.position.x / monitor.scaleFactor
        const y = (monitor.position.y / monitor.scaleFactor) + ((monitor.size.height / monitor.scaleFactor) - height) / 2
        await appWindow.setPosition(new LogicalPosition(x, y))
        await appWindow.setSize(new LogicalSize(width, height))
    }

    // 关闭主窗口时只隐藏，不退出；只有托盘的“退出”(destroy) 才真正退出
    await appWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await appWindow.hide();
    });
}

disableDefaultInteractions()
void setupMainWindow()