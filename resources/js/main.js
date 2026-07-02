const STORAGE_KEY = 'wallpaper_sources';
const CACHE_KEY   = 'wallpaper_cache';

let APP_DIR   = NL_PATH;   // resolved to absolute path at startup
let CACHE_DIR = '';        // set after APP_DIR is resolved

let allWallpapers = [];   // [null | { url, localPath }]  — null = placeholder
let currentIndex  = -1;
let activeTotal   = 0;
let activeLoaded  = 0;
let blobUrls      = [];   // tracked for revocation on carousel rebuild

// ─── Progress ─────────────────────────────────────────────────────────────────

function updateProgress() {
    const el = document.getElementById('dl-progress');
    if (!el) return;
    if (activeLoaded < activeTotal) {
        el.textContent = `↓ ${activeLoaded} / ${activeTotal}`;
    } else {
        el.textContent = '';
    }
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

function buildPlaceholderCarousel(urls) {
    const track = document.getElementById('carousel-track');
    track.innerHTML = '';

    // Revoke previous blob URLs to free memory
    blobUrls.forEach(u => URL.revokeObjectURL(u));
    blobUrls = [];
    allWallpapers = new Array(urls.length).fill(null);
    activeTotal  = urls.length;
    activeLoaded = 0;
    currentIndex = -1;
    updateProgress();

    if (urls.length === 0) {
        const tip = document.createElement('div');
        tip.className = 'empty-tip';
        tip.style.cssText = 'color:#aaa;font-size:13px;padding:20px;white-space:nowrap;';
        tip.textContent = '该源暂无壁纸';
        track.appendChild(tip);
        return;
    }

    urls.forEach((url, i) => {
        const card = createCard(url, i);
        track.appendChild(card);
    });
}

function createCard(url, index) {
    const card = document.createElement('div');
    card.className = 'wallpaper-card';
    card.dataset.index = index;
    card.dataset.url   = url;

    const loading = document.createElement('div');
    loading.className = 'card-loading';

    const img = document.createElement('img');
    img.style.display = 'none';
    img.style.cssText  = 'width:100%;height:100%;object-fit:cover;display:none;';

    card.appendChild(loading);
    card.appendChild(img);

    card.addEventListener('click', () => {
        if (allWallpapers[index]) selectWallpaper(index);
    });

    return card;
}

// Called when an image is ready (cached or freshly downloaded)
function resolveCard(url, localPath) {
    const card = document.querySelector(`.wallpaper-card[data-url="${CSS.escape(url)}"]`);
    if (!card) return;

    const index   = parseInt(card.dataset.index);
    allWallpapers[index] = { url, localPath };

    const img     = card.querySelector('img');
    const loading = card.querySelector('.card-loading');

    img.onload = () => {
        img.style.display = 'block';
        loading.style.display = 'none';
        activeLoaded++;
        updateProgress();
    };
    img.onerror = () => {
        loading.textContent = '!';
        activeLoaded++;
        updateProgress();
    };
    // Read file and create a blob: URL — avoids all webview file:// and server restrictions
    Neutralino.filesystem.readBinaryFile(localPath).then(data => {
        const ext  = localPath.split('.').pop().toLowerCase();
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                       webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/jpeg';
        const blobUrl = URL.createObjectURL(new Blob([data], { type: mime }));
        blobUrls.push(blobUrl);
        img.src = blobUrl;
    }).catch(() => {
        loading.textContent = '!';
        activeLoaded++;
        updateProgress();
    });
}

// ─── Select & Apply ───────────────────────────────────────────────────────────

function selectWallpaper(index) {
    if (index < 0 || index >= allWallpapers.length || !allWallpapers[index]) return;

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
    let next = (currentIndex + 1) % allWallpapers.length;
    // Find next loaded card
    for (let i = 0; i < allWallpapers.length; i++) {
        const idx = (next + i) % allWallpapers.length;
        if (allWallpapers[idx]) { selectWallpaper(idx); return; }
    }
}

function selectPrev() {
    if (allWallpapers.length === 0) return;
    let prev = (currentIndex - 1 + allWallpapers.length) % allWallpapers.length;
    for (let i = 0; i < allWallpapers.length; i++) {
        const idx = (prev - i + allWallpapers.length) % allWallpapers.length;
        if (allWallpapers[idx]) { selectWallpaper(idx); return; }
    }
}

async function applyWallpaper(localPath) {
    const scriptsDir = `${APP_DIR}/resources/scripts`;
    let cmd;
    if (NL_OS === 'Linux') {
        cmd = `bash "${scriptsDir}/fedora.sh" "${localPath}"`;
    } else if (NL_OS === 'Windows') {
        cmd = `cmd /c ""${scriptsDir}\\windows.bat" "${localPath}""`;
    }
    if (cmd) {
        try { await Neutralino.os.execCommand(cmd); }
        catch (err) { console.error('applyWallpaper failed:', err); }
    }
}

// ─── Cache Map ────────────────────────────────────────────────────────────────

async function loadCacheMap() {
    try {
        const raw = await Neutralino.storage.getData(CACHE_KEY);
        return JSON.parse(raw) || {};
    } catch { return {}; }
}

async function saveCacheMap(map) {
    await Neutralino.storage.setData(CACHE_KEY, JSON.stringify(map));
}

// ─── Download Queue ───────────────────────────────────────────────────────────

const downloadQueue = [];
const queuedUrls   = new Set();
let   isDownloading = false;

function getLocalFilename(url) {
    try {
        const pathname = new URL(url).pathname.split('?')[0];
        const ext = (pathname.match(/\.(\w{2,5})$/) || [,'jpg'])[1].toLowerCase();
        const hash = [...url].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
        return `${(hash >>> 0).toString(16)}.${ext}`;
    } catch {
        return `${Date.now()}.jpg`;
    }
}

function buildDownloadCmd(url, destPath) {
    if (NL_OS === 'Linux' || NL_OS === 'Darwin') {
        return `curl -sL --max-time 60 "${url}" -o "${destPath}"`;
    } else if (NL_OS === 'Windows') {
        return `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${destPath}' -UseBasicParsing"`;
    }
    return null;
}

async function downloadImage(url) {
    const localPath = `${CACHE_DIR}/${getLocalFilename(url)}`;

    // Return early if already on disk and non-empty
    try {
        const stats = await Neutralino.filesystem.getStats(localPath);
        if (stats.size > 0) return localPath;
    } catch {}

    const cmd = buildDownloadCmd(url, localPath);
    if (!cmd) throw new Error('Unsupported OS for download');

    const result = await Neutralino.os.execCommand(cmd);
    if (result.exitCode !== 0) throw new Error(result.stdErr || `exit ${result.exitCode}`);

    // Verify file was actually written
    const stats = await Neutralino.filesystem.getStats(localPath);
    if (!stats || stats.size === 0) throw new Error('Downloaded file is empty');

    return localPath;
}

function enqueueUrl(url, interval) {
    if (queuedUrls.has(url)) return;
    queuedUrls.add(url);
    downloadQueue.push({ url, interval });
}

async function processQueue() {
    if (isDownloading) return;
    isDownloading = true;

    while (downloadQueue.length > 0) {
        const { url, interval } = downloadQueue.shift();

        try {
            const cacheMap  = await loadCacheMap();

            // If cache entry exists, re-verify the file is on disk
            if (cacheMap[url]) {
                try {
                    const stats = await Neutralino.filesystem.getStats(cacheMap[url]);
                    if (stats.size > 0) {
                        resolveCard(url, cacheMap[url]);
                        continue;
                    }
                } catch {}
                // File missing — fall through to re-download
                delete cacheMap[url];
            }

            const localPath = await downloadImage(url);
            cacheMap[url]   = localPath;
            await saveCacheMap(cacheMap);
            resolveCard(url, localPath);
        } catch (err) {
            console.error('Download failed:', url, err);
            // Count as "done" so progress still advances
            activeLoaded++;
            updateProgress();
        }

        if (downloadQueue.length > 0 && interval > 0) {
            await new Promise(r => setTimeout(r, interval));
        }
    }

    isDownloading = false;
}

// ─── Activate Source ──────────────────────────────────────────────────────────

async function activateSource(source) {
    // Stop pending downloads
    downloadQueue.length = 0;
    queuedUrls.clear();

    await ensureCacheDir();
    const cacheMap = await loadCacheMap();
    const urls     = source.data || [];
    const interval = source.download_interval ?? 500;

    buildPlaceholderCarousel(urls);

    for (const url of urls) {
        const cached = cacheMap[url];
        if (cached) {
            // Verify on disk; if missing, mark for re-download
            try {
                const stats = await Neutralino.filesystem.getStats(cached);
                if (stats.size > 0) {
                    resolveCard(url, cached);
                    continue;
                }
            } catch {}
            delete cacheMap[url];
            await saveCacheMap(cacheMap);
        }
        enqueueUrl(url, interval);
    }

    processQueue();
}

// ─── Storage / Startup ────────────────────────────────────────────────────────

async function ensureCacheDir() {
    try { await Neutralino.filesystem.createDirectory(CACHE_DIR); } catch {}
}

async function loadFromStorage() {
    let sources = [];
    try {
        const raw = await Neutralino.storage.getData(STORAGE_KEY);
        sources   = JSON.parse(raw) || [];
    } catch {}

    const active = sources.find(s => s.active);
    if (active) {
        await activateSource(active);
    } else {
        buildPlaceholderCarousel([]);
        const tip = document.getElementById('carousel-track').querySelector('.empty-tip');
        if (tip) tip.textContent = '暂无壁纸，请右键托盘图标 → 设置 → 添加源';
    }
}

// ─── Source Manager Window ────────────────────────────────────────────────────

async function openSourceManager() {
    try {
        await Neutralino.window.create('/source-manager.html', {
            title: '壁纸源管理',
            width: 520,
            height: 380,
            alwaysOnTop: true,
            center: true,
            resizable: false,
        });
    } catch (err) { console.error('openSourceManager failed:', err); }
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
        case "SOURCES": openSourceManager();    break;
        case "PREV":    selectPrev();           break;
        case "NEXT":    selectNext();           break;
        case "QUIT":    Neutralino.app.exit();  break;
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('carousel-wrapper').addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        document.getElementById('carousel-wrapper').scrollLeft += e.deltaY * 1.5;
    }
}, { passive: false });

async function resolveAppDir() {
    try {
        let cmd;
        if (NL_OS === 'Windows') {
            cmd = `powershell -NoProfile -Command "(Get-Location).Path"`;
        } else {
            cmd = `realpath "${NL_PATH}"`;
        }
        const r = await Neutralino.os.execCommand(cmd);
        const resolved = r.stdOut.trim();
        if (resolved) APP_DIR = resolved;
    } catch {}
    CACHE_DIR = `${APP_DIR}/wallpaper-cache`;
}

Neutralino.init();
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", () => Neutralino.app.exit());
Neutralino.events.on("source_activated", e => activateSource(e.detail));

if (NL_OS != "Darwin") setTray();

resolveAppDir().then(loadFromStorage);
