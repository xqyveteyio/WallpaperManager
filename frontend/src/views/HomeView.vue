<template>
    <div>
        <h1>Home</h1>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { setupTray } from '@/utils/tray';
import { quitApp } from '@/utils/lifecycle';

onMounted(() => {
    setupTray()
    // 关闭主窗口时退出整个应用（含设置窗口）
    Neutralino.events.on('windowClose', quitApp)
})
</script>