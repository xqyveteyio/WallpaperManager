const COLORS = [
    '#c0c0c0', '#a0a0b0', '#b0b8c0', '#c0b8a0', '#b0c0a8',
    '#c0a8a8', '#a8b0c0', '#b8c0a8', '#c0a8b8', '#a8c0b8',
];

function buildCarousel(count) {
    const track = document.getElementById('carousel-track');
    track.innerHTML = '';

    for (let i = 1; i <= count; i++) {
        const card = document.createElement('div');
        card.className = 'wallpaper-card';
        card.style.background = COLORS[(i - 1) % COLORS.length];

        card.addEventListener('click', () => onWallpaperSelect(i, card));

        track.appendChild(card);
    }
}

function onWallpaperSelect(index, card) {
    console.log(`Selected wallpaper #${index}`);
}

// Enable smooth horizontal scroll via mouse wheel
document.getElementById('carousel-wrapper').addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        document.getElementById('carousel-wrapper').scrollLeft += e.deltaY * 1.5;
    }
}, { passive: false });

function setTray() {
    if (NL_MODE != "window") return;

    Neutralino.os.setTray({
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            { id: "QUIT", text: "Quit" }
        ]
    });
}

function onTrayMenuItemClicked(event) {
    if (event.detail.id === "QUIT") {
        Neutralino.app.exit();
    }
}

function onWindowClose() {
    Neutralino.app.exit();
}

Neutralino.init();
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

if (NL_OS != "Darwin") {
    setTray();
}

buildCarousel(50);
