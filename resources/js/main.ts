import Neutralino from "./neutralino";

function selectNext() {
}

function selectPrev() {
}

async function applyWallpaper(localPath) {

}



// ─── Tray ─────────────────────────────────────────────────────────────────────

function setTray() {
    if (Window.NL_MODE != "window") return;
    Neutralino.os.setTray({
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            { id: "SOURCES", text: "设置 - 源管理" },
            { id: "SEP1",    text: "-" },
            { id: "PREV",    text: "上一张" },
            { id: "NEXT",    text: "下一张" },
            { id: "SEP2",    text: "-" },
            { id: "QUIT",    text: "退出" }
        ]
    });
}

function onTrayMenuItemClicked(event) {
    switch (event.detail.id) {
        case "SOURCES": openSourceManager();    break;
        case "PREV":    selectPrev();           break;
        case "NEXT":    selectNext();           break;
        case "QUIT":    Neutralino.app.exit();  break;
    }
}


Neutralino.init();
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", () => Neutralino.app.exit());

if (NL_OS != "Darwin") setTray();
