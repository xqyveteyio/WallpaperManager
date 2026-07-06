<template>
    <div class="wallpaper-carousel" ref="wallpaperCarouselRef">
        <div class="thumb-item" v-for="(item, index) in thumbs" @click="handleClick($event, index)"
            :class="{ 'active': current_wallpaper === item }">
            <img :src="item" alt="">
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
    thumbs?: string[]
    current_wallpaper: string
}
withDefaults(defineProps<Props>(), {
    current_wallpaper: "",
    thumbs: () => []
})
const emit = defineEmits<{
    (e: 'selectWallpaper', index: number): void
}>()
const wallpaperCarouselRef = ref<HTMLDivElement | null>(null)

const handleClick = (event: MouseEvent, index: number) => {
    emit('selectWallpaper', index)
    const container = wallpaperCarouselRef.value
    const target = event.currentTarget as HTMLElement
    if (container && target) {
        const targetLeft = target.offsetLeft
        const targetWidth = target.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollToX = targetLeft + (targetWidth / 2) - (containerWidth / 2)
        container.scrollTo({
            left: scrollToX,
            behavior: 'smooth'
        })
    }
}
</script>

<style lang="scss" scoped>
.wallpaper-carousel {
    width: 100%;
    height: 140px;
    background-color: skyblue;
    display: flex;
    overflow-y: hidden;
    overflow-x: auto;

    .thumb-item {
        width: auto;
        height: 100%;
        display: flex;

        img {
            height: 100%;
        }

        &.active {
            position: relative;

            &::after {
                content: ""; // 💡 必须写！哪怕是空字符串
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 4px;
                background-color: #ff692c;
            }
        }
    }
}
</style>