const STORAGE_KEY = 'wallpaper_sources';

let allWallpapers = [];   // flat list of image URLs from all sources
let currentIndex = -1;    // currently selected wallpaper index
let sourceManagerWin = null;

// ─── Carousel ────────────────────────────────────────────────────────────────

function buildCarousel(wallpapers) {
    const track = document.getElementById('carousel-track');
    track.innerHTML = '';
    allWallpapers = wallpapers;

    if (wallpapers.length === 0) {
        const tip = document.createElement('div');
        tip.style.cssText = 'color:#aaa;font-size:13px;padding:20px;white-space:nowrap;';
        tip.textContent = '暂无壁纸，请右键托盘图标 → 设置 → 添加源';
        track.appendChild(tip);
        return;
    }

    wallpapers.forEach((url, i) => {
        const card = document.createElement('div');
        card.className = 'wallpaper-card';
        card.dataset.index = i;

        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.draggable = false;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

        card.appendChild(img);
        card.addEventListener('click', () => selectWallpaper(i));
        track.appendChild(card);
    });
}

function selectWallpaper(index) {
    if (index < 0 || index >= allWallpapers.length) return;

    document.querySelectorAll('.wallpaper-card').forEach(c => {
        c.style.outline = '';
    });

    currentIndex = index;
    const card = document.querySelector(`.wallpaper-card[data-index="${index}"]`);
    if (card) {
        card.style.outline = '2px solid #555';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

function selectNext() {
    if (allWallpapers.length === 0) return;
    selectWallpaper((currentIndex + 1) % allWallpapers.length);
}

function selectPrev() {
    if (allWallpapers.length === 0) return;
    selectWallpaper((currentIndex - 1 + allWallpapers.length) % allWallpapers.length);
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function loadFromStorage() {
    try {
        const raw = await Neutralino.storage.getData(STORAGE_KEY);
        const sources = JSON.parse(raw) || [];
        const all = sources.flatMap(s => s.data || []);
        buildCarousel(all);
    } catch {
        buildCarousel([]);
    }
}

// ─── Source Manager Window ───────────────────────────────────────────────────

async function openSourceManager() {
    try {
        await Neutralino.window.create('/source-manager.html', {
            title: '壁纸源管理',
            width: 480,
            height: 360,
            alwaysOnTop: true,
            center: true,
            resizable: false,
        });
    } catch (err) {
        console.error('Failed to open source manager:', err);
    }
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function setTray() {
    if (NL_MODE != "window") return;

    Neutralino.os.setTray({
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            { id: "SOURCES", text: "设置 - 源管理" },
            { id: "SEP1", text: "-" },
            { id: "PREV", text: "上一张" },
            { id: "NEXT", text: "下一张" },
            { id: "SEP2", text: "-" },
            { id: "QUIT", text: "退出" }
        ]
    });
}

function onTrayMenuItemClicked(event) {
    switch (event.detail.id) {
        case "SOURCES": openSourceManager(); break;
        case "PREV":    selectPrev();        break;
        case "NEXT":    selectNext();        break;
        case "QUIT":    Neutralino.app.exit(); break;
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('carousel-wrapper').addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        document.getElementById('carousel-wrapper').scrollLeft += e.deltaY * 1.5;
    }
}, { passive: false });

Neutralino.init();
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", () => Neutralino.app.exit());
Neutralino.events.on("sources_updated", loadFromStorage);

if (NL_OS != "Darwin") {
    setTray();
}

loadFromStorage();
