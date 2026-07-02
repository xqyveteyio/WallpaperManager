const STORAGE_KEY = 'wallpaper_sources';
const CACHE_KEY   = 'wallpaper_cache';
const CACHE_DIR   = `${NL_PATH}/.cache/wallpapers`;

let allWallpapers = [];   // [{ url, localPath }]
let currentIndex  = -1;

// ─── Carousel ─────────────────────────────────────────────────────────────────

function buildCarousel(wallpapers) {
    const track = document.getElementById('carousel-track');
    track.innerHTML = '';
    allWallpapers = [];

    if (wallpapers.length === 0) {
        const tip = document.createElement('div');
        tip.className = 'empty-tip';
        tip.style.cssText = 'color:#aaa;font-size:13px;padding:20px;white-space:nowrap;';
        tip.textContent = '暂无壁纸，请右键托盘图标 → 设置 → 添加源';
        track.appendChild(tip);
        return;
    }

    wallpapers.forEach(wp => appendCard(wp));
}

function appendCard(wallpaper) {
    const index = allWallpapers.length;
    allWallpapers.push(wallpaper);

    const track = document.getElementById('carousel-track');
    const tip = track.querySelector('.empty-tip');
    if (tip) tip.remove();

    const card = document.createElement('div');
    card.className = 'wallpaper-card';
    card.dataset.index = index;

    const img = document.createElement('img');
    img.src = `file://${wallpaper.localPath}`;
    img.alt = '';
    img.draggable = false;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

    card.appendChild(img);
    card.addEventListener('click', () => selectWallpaper(index));
    track.appendChild(card);
}

// ─── Select & Apply ───────────────────────────────────────────────────────────

function selectWallpaper(index) {
    if (index < 0 || index >= allWallpapers.length) return;

    currentIndex = index;
    document.querySelectorAll('.wallpaper-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.wallpaper-card[data-index="${index}"]`);
    if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    applyWallpaper(allWallpapers[index].localPath);
}

function selectNext() {
    if (allWallpapers.length === 0) return;
    selectWallpaper((currentIndex + 1) % allWallpapers.length);
}

function selectPrev() {
    if (allWallpapers.length === 0) return;
    selectWallpaper((currentIndex - 1 + allWallpapers.length) % allWallpapers.length);
}

async function applyWallpaper(localPath) {
    const scriptsDir = `${NL_PATH}/resources/scripts`;
    let cmd;

    if (NL_OS === 'Linux') {
        cmd = `bash "${scriptsDir}/fedora.sh" "${localPath}"`;
    } else if (NL_OS === 'Windows') {
        cmd = `cmd /c ""${scriptsDir}\\windows.bat" "${localPath}""`;
    }

    if (cmd) {
        try {
            await Neutralino.os.execCommand(cmd);
        } catch (err) {
            console.error('Failed to apply wallpaper:', err);
        }
    }
}

// ─── Cache Map (url → localPath) ─────────────────────────────────────────────

async function loadCacheMap() {
    try {
        const raw = await Neutralino.storage.getData(CACHE_KEY);
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
}

async function saveCacheMap(map) {
    await Neutralino.storage.setData(CACHE_KEY, JSON.stringify(map));
}

// ─── Download Queue ───────────────────────────────────────────────────────────

const downloadQueue  = [];   // [{ url, interval }]
const queuedUrls     = new Set();
let   isDownloading  = false;

function getLocalFilename(url) {
    try {
        const pathname = new URL(url).pathname;
        const base = pathname.split('/').pop() || 'wallpaper';
        const ext  = (base.match(/\.(\w+)$/) || [, 'jpg'])[1].toLowerCase();
        // simple djb2 hash
        const hash = [...url].reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
        return `${(hash >>> 0).toString(16)}.${ext}`;
    } catch {
        return `${Date.now()}.jpg`;
    }
}

async function downloadImage(url) {
    const localPath = `${CACHE_DIR}/${getLocalFilename(url)}`;

    // Return early if already on disk
    try {
        await Neutralino.filesystem.getStats(localPath);
        return localPath;
    } catch {}

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    await Neutralino.filesystem.writeBinaryFile(localPath, buffer);
    return localPath;
}

async function processQueue() {
    if (isDownloading) return;
    isDownloading = true;

    while (downloadQueue.length > 0) {
        const { url, interval } = downloadQueue.shift();

        try {
            const cacheMap  = await loadCacheMap();
            const localPath = cacheMap[url] || await downloadImage(url);

            if (!cacheMap[url]) {
                cacheMap[url] = localPath;
                await saveCacheMap(cacheMap);
            }

            // Add to carousel only if not already shown
            if (!allWallpapers.find(w => w.url === url)) {
                appendCard({ url, localPath });
            }
        } catch (err) {
            console.error('Download failed:', url, err);
        }

        if (downloadQueue.length > 0 && interval > 0) {
            await new Promise(r => setTimeout(r, interval));
        }
    }

    isDownloading = false;
}

function enqueueUrl(url, interval) {
    if (queuedUrls.has(url) || allWallpapers.find(w => w.url === url)) return;
    queuedUrls.add(url);
    downloadQueue.push({ url, interval });
}

// ─── Storage / Init Carousel ──────────────────────────────────────────────────

async function ensureCacheDir() {
    try { await Neutralino.filesystem.createDirectory(CACHE_DIR); } catch {}
}

async function loadFromStorage() {
    await ensureCacheDir();
    const cacheMap = await loadCacheMap();

    let sources = [];
    try {
        const raw = await Neutralino.storage.getData(STORAGE_KEY);
        sources = JSON.parse(raw) || [];
    } catch {}

    // Build carousel from already-cached images first
    const cached = [];
    for (const src of sources) {
        for (const url of (src.data || [])) {
            if (cacheMap[url]) cached.push({ url, localPath: cacheMap[url] });
        }
    }
    buildCarousel(cached);

    // Queue uncached images for download
    for (const src of sources) {
        const interval = src.download_interval ?? 500;
        for (const url of (src.data || [])) {
            if (!cacheMap[url]) enqueueUrl(url, interval);
        }
    }
    processQueue();
}

// Called when source-manager adds a new source
async function syncNewSources() {
    const cacheMap = await loadCacheMap();
    let sources = [];
    try {
        const raw = await Neutralino.storage.getData(STORAGE_KEY);
        sources = JSON.parse(raw) || [];
    } catch {}

    for (const src of sources) {
        const interval = src.download_interval ?? 500;
        for (const url of (src.data || [])) {
            if (!cacheMap[url]) {
                enqueueUrl(url, interval);
            } else if (!allWallpapers.find(w => w.url === url)) {
                appendCard({ url, localPath: cacheMap[url] });
            }
        }
    }
    processQueue();
}

// ─── Source Manager Window ────────────────────────────────────────────────────

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
        case "SOURCES": openSourceManager();      break;
        case "PREV":    selectPrev();             break;
        case "NEXT":    selectNext();             break;
        case "QUIT":    Neutralino.app.exit();    break;
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
Neutralino.events.on("sources_updated", syncNewSources);

if (NL_OS != "Darwin") {
    setTray();
}

loadFromStorage();
