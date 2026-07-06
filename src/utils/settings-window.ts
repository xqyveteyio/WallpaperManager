import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const SETTINGS_LABEL = 'settings';

export const openSettingsWindow = async () => {
    // 已存在则激活（显示 + 聚焦），不再新建
    const existing = await WebviewWindow.getByLabel(SETTINGS_LABEL);
    if (existing) {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        return existing;
    }

    const settings = new WebviewWindow(SETTINGS_LABEL, {
        url: 'index.html#/settings',
        title: '设置',
        width: 800,
        height: 600,
        resizable: true,
    });

    settings.once('tauri://error', (e) => {
        console.error('创建设置窗口失败:', e);
    });

    return settings;
};
