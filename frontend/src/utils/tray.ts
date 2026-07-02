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
        // 原生托盘加载图标走 resources 模块，按“项目根起始的完整路径”在资源树里查找，
        // 不会像 Web 服务器那样自动补 documentRoot 前缀。所以这里必须带上 documentRoot
        // (/frontend/dist)，否则打包后找不到图标（托盘有菜单但没图标）。
        icon: '/frontend/dist/resources/icons/trayIcon.png',
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
