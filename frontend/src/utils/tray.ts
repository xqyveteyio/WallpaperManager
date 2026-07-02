import { openConfigWindow } from './config';
import { quitApp } from './lifecycle';

// 处理托盘菜单点击
export const onTrayMenuItemClicked = (evt: any) => {
    switch (evt.detail.id) {
        case "CONFIG": openConfigWindow(); break;
        // case "PREV": selectPrev(); break;
        // case "NEXT": selectNext(); break;
        case "QUIT": quitApp(); break;
    }
}

// 初始化托盘
export const setupTray = async () => {
    await Neutralino.os.setTray({
        icon: '/resources/icons/trayIcon.png',
        menuItems: [
            { id: "CONFIG", text: "设置" },
            { id: "PREV", text: "上一张" },
            { id: "NEXT", text: "下一张" },
            { id: "QUIT", text: "退出" }
        ]
    })

    // 监听托盘菜单点击事件
    Neutralino.events.on('trayMenuItemClicked', onTrayMenuItemClicked)
}
