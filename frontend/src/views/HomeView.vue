<template>
    <div class="home-view">
        <WallpaperCarousel/>
    </div>
</template>

<script setup lang="ts">
import WallpaperCarousel from '@/components/WallpaperCarousel.vue';
import { onMounted } from 'vue';
import { setupTray } from '@/utils/tray';
import { quitApp } from '@/utils/lifecycle';

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