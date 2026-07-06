import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { getCurrentWindow, getAllWindows } from '@tauri-apps/api/window';
import { openSettingsWindow } from './settings-window';

const TRAY_ID = 'main-tray';

export const createTray = async () => {
    // 固定 id + 存在检查，避免 HMR 或重复调用创建出多个托盘
    const existing = await TrayIcon.getById(TRAY_ID);
    if (existing) {
        return existing;
    }

    const icon = await defaultWindowIcon();

    const menu = await Menu.new({
        items: [
            {
                id: 'show',
                text: '显示',
                action: async () => {
                    const win = getCurrentWindow();
                    await win.show();
                    await win.setFocus();
                },
            },
            {
                id: 'settings',
                text: '设置',
                action: async () => {
                    await openSettingsWindow();
                },
            },
            {
                id: 'quit',
                text: '退出',
                action: async () => {
                    // 销毁所有窗口（含设置子窗口），否则子窗口还开着应用不会退出
                    const windows = await getAllWindows();
                    await Promise.all(windows.map((w) => w.destroy()));
                },
            },
        ],
    });

    const tray = await TrayIcon.new({
        id: TRAY_ID,
        ...(icon ? { icon } : {}),
        menu,
        tooltip: 'Wallpaper Manager',
        showMenuOnLeftClick: false,
    });

    return tray;
}
