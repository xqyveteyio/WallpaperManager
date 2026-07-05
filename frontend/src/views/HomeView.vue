<template>
    <div class="home-view">
        <WallpaperCarousel :thumbs="wallpapers" @selectWallpaper="onSelectWallpaper"
            :current_wallpaper="current_wallpaper" />
    </div>
</template>

<script setup lang="ts">
import WallpaperCarousel from '@/components/WallpaperCarousel.vue';
import { ref, onMounted } from 'vue';
import { setupTray } from '@/utils/tray';
import { quitApp } from '@/utils/lifecycle';
import { fileDownloader } from '@/utils/file-manager'

const current_wallpaper = ref<string>()
const wallpapers = [
    "https://images4.alphacoders.com/135/thumb-1920-1357925.png",
    "https://images8.alphacoders.com/136/thumb-1920-1362046.png",
    "https://images7.alphacoders.com/101/thumb-1920-1012056.jpg",
    "https://images3.alphacoders.com/138/thumb-1920-1386673.jpg",
    "https://images2.alphacoders.com/140/thumb-1920-1407959.png",
    "https://images5.alphacoders.com/132/thumb-1920-1324025.jpeg",
    "https://images.alphacoders.com/129/thumb-1920-1293319.png",
    "https://images7.alphacoders.com/127/thumb-1920-1277360.jpg",
    "https://images4.alphacoders.com/140/thumb-1920-1409039.png",
    "https://images5.alphacoders.com/139/thumb-1920-1395932.jpg",
    "https://images4.alphacoders.com/140/thumb-1920-1401145.png"
]

const onSelectWallpaper = async (url: string) => {
    current_wallpaper.value = url
    try {
        const savedPath = await fileDownloader(url, "/home/keyboard/Documents/GitHub/WallpaperManager")
        console.log('壁纸已下载至:', savedPath)
    } catch (error) {
        console.error('设置壁纸失败:', error)
        alert(`下载失败: ${error instanceof Error ? error.message : error}`)
    }
}

onMounted(() => {
    setupTray()
    // 关闭主窗口时退出整个应用（含设置窗口）
    Neutralino.events.on('windowClose', quitApp)
})
</script>


<style lang="scss" scoped>
.home-view {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>