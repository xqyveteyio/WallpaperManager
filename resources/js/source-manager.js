const STORAGE_KEY = 'wallpaper_sources';

let sources = [];

// ─── Storage ──────────────────────────────────────────────────────────────────

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
}

// ─── Activate ─────────────────────────────────────────────────────────────────

async function activateSource(index) {
    sources = sources.map((s, i) => ({ ...s, active: i === index }));
    await saveSources();
    await Neutralino.events.broadcast('source_activated', sources[index]);
    renderList();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderList() {
    const list  = document.getElementById('source-list');
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

        const info = document.createElement('div');
        info.className = 'source-info';
        info.innerHTML = `
            <div class="source-name">${escapeHtml(src.name || src.url)}</div>
            <div class="source-meta">${escapeHtml(src.url)}</div>
        `;

        const count = document.createElement('div');
        count.className = 'source-count';
        count.textContent = `${src.data.length} 张`;

        const activateBtn = document.createElement('button');
        if (src.active) {
            activateBtn.className = 'active-indicator';
            activateBtn.textContent = '已激活';
            activateBtn.disabled = true;
        } else {
            activateBtn.textContent = '激活';
            activateBtn.addEventListener('click', () => activateSource(index));
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => deleteSource(index));

        item.append(info, count, activateBtn, deleteBtn);
        list.appendChild(item);
    });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteSource(index) {
    const wasActive = sources[index].active;
    sources.splice(index, 1);

    // If we deleted the active source, activate the first remaining one
    if (wasActive && sources.length > 0) {
        sources[0].active = true;
        await saveSources();
        await Neutralino.events.broadcast('source_activated', sources[0]);
    } else {
        await saveSources();
        if (sources.length === 0) {
            await Neutralino.events.broadcast('source_activated', null);
        }
    }
    renderList();
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const overlay    = document.getElementById('modal-overlay');
const urlInput   = document.getElementById('url-input');
const tip        = document.getElementById('modal-tip');
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

overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('visible');
});

confirmBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { tip.textContent = '请输入有效的 URL'; return; }

    if (sources.find(s => s.url === url)) {
        tip.textContent = '该源已存在';
        return;
    }

    confirmBtn.disabled = true;
    tip.textContent = '正在获取...';

    try {
        const res  = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json.data)) throw new Error('格式错误：缺少 data 数组');

        const isFirst = sources.length === 0;
        sources.push({
            url,
            name:              json.name              || url,
            description:       json.description       || '',
            author:            json.author            || '',
            last_update:       json.last_update        || '',
            download_interval: json.download_interval ?? 500,
            data:              json.data,
            active:            isFirst,
        });

        await saveSources();

        // Auto-activate the first source
        if (isFirst) {
            await Neutralino.events.broadcast('source_activated', sources[0]);
        }

        overlay.classList.remove('visible');
        renderList();
    } catch (err) {
        tip.textContent = `获取失败：${err.message}`;
        confirmBtn.disabled = false;
    }
});

urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmBtn.click();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

Neutralino.init();
Neutralino.events.on('windowClose', () => Neutralino.window.hide());
loadSources();
