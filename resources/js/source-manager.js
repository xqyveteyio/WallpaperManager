const STORAGE_KEY = 'wallpaper_sources';

let sources = [];

async function loadSources() {
    try {
        const raw = await Neutralino.storage.getData(STORAGE_KEY);
        sources = JSON.parse(raw) || [];
    } catch {
        sources = [];
    }
    renderList();
}

async function saveSources() {
    await Neutralino.storage.setData(STORAGE_KEY, JSON.stringify(sources));
    // Notify main window to reload carousel
    await Neutralino.events.broadcast('sources_updated', {});
}

function renderList() {
    const list = document.getElementById('source-list');
    const empty = document.getElementById('empty-tip');

    if (sources.length === 0) {
        list.innerHTML = '';
        list.appendChild(empty);
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = '';

    sources.forEach((src, index) => {
        const item = document.createElement('div');
        item.className = 'source-item';

        item.innerHTML = `
            <div class="source-info">
                <div class="source-name">${escapeHtml(src.name || src.url)}</div>
                <div class="source-meta">${escapeHtml(src.url)}</div>
            </div>
            <div class="source-count">${src.data.length} 张</div>
            <button class="danger" data-index="${index}">删除</button>
        `;

        item.querySelector('button').addEventListener('click', () => deleteSource(index));
        list.appendChild(item);
    });
}

async function deleteSource(index) {
    sources.splice(index, 1);
    await saveSources();
    renderList();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Modal logic
const overlay = document.getElementById('modal-overlay');
const urlInput = document.getElementById('url-input');
const tip = document.getElementById('modal-tip');
const confirmBtn = document.getElementById('modal-confirm');

document.getElementById('btn-add').addEventListener('click', () => {
    urlInput.value = '';
    tip.textContent = '';
    confirmBtn.disabled = false;
    overlay.classList.add('visible');
    urlInput.focus();
});

document.getElementById('modal-cancel').addEventListener('click', () => {
    overlay.classList.remove('visible');
});

overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('visible');
});

confirmBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        tip.textContent = '请输入有效的 URL';
        return;
    }

    confirmBtn.disabled = true;
    tip.textContent = '正在获取...';

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();

        if (!Array.isArray(json.data)) {
            throw new Error('格式错误：缺少 data 数组');
        }

        // Check for duplicate URL
        if (sources.find(s => s.url === url)) {
            tip.textContent = '该源已存在';
            confirmBtn.disabled = false;
            return;
        }

        sources.push({
            url,
            name: json.name || url,
            description: json.description || '',
            author: json.author || '',
            last_update: json.last_update || '',
            data: json.data,
        });

        await saveSources();
        overlay.classList.remove('visible');
        renderList();
    } catch (err) {
        tip.textContent = `获取失败：${err.message}`;
        confirmBtn.disabled = false;
    }
});

urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBtn.click();
});

Neutralino.init();

Neutralino.events.on('windowClose', () => {
    Neutralino.window.hide();
});

loadSources();
