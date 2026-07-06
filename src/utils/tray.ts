import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { getCurrentWindow, getAllWindows } from '@tauri-apps/api/window';
import { openSettingsWindow } from './settings-window';
import { readMainWindowSettings } from './window-settings';

const TRAY_ID = 'main-tray';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const raiseMainWindow = async () => {
    const win = getCurrentWindow();
    const settings = readMainWindowSettings()

    await win.show();
    await win.unminimize();

    // GNOME/Wayland may block direct focus stealing from tray actions.
    // A brief topmost pulse makes the restored window visible, then we restore the user setting.
    await win.setAlwaysOnTop(true);
    await win.setFocus();

    if (!settings.alwaysOnTop) {
        await delay(250);
        await win.setAlwaysOnTop(false);
    }
}

const buildTrayMenu = async () => {
    const win = getCurrentWindow();
    const isVisible = await win.isVisible();

    return await Menu.new({
        items: [
            {
                id: 'toggle-main-window',
                text: isVisible ? '隐藏' : '显示',
                action: async () => {
                    if (await win.isVisible()) {
                        await win.hide();
                    } else {
                        await raiseMainWindow();
                    }

                    await refreshTrayMenu();
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
}

export const refreshTrayMenu = async () => {
    const tray = await TrayIcon.getById(TRAY_ID);
    if (!tray) {
        return
    }

    await tray.setMenu(await buildTrayMenu());
}

export const createTray = async () => {
    // 固定 id + 存在检查，避免 HMR 或重复调用创建出多个托盘
    const existing = await TrayIcon.getById(TRAY_ID);
    if (existing) {
        await refreshTrayMenu();
        return existing;
    }

    const icon = await defaultWindowIcon();

    const tray = await TrayIcon.new({
        id: TRAY_ID,
        ...(icon ? { icon } : {}),
        menu: await buildTrayMenu(),
        tooltip: 'Wallpaper Manager',
        showMenuOnLeftClick: false,
    });

    return tray;
}
