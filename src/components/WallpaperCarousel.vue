<template>
    <div class="wallpaper-carousel" ref="wallpaperCarouselRef" @click="closeContextMenu">
        <div class="thumb-item" v-for="(item, index) in thumbs" @click="handleClick($event, index)"
            @contextmenu.prevent.stop="openContextMenu($event, index)"
            :class="{ 'active': current_wallpaper === item }">
            <img :src="item" alt="">
        </div>

        <div v-if="contextMenu.visible" class="context-menu"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }">
            <button type="button" :disabled="isContextMenuItemFavorited" @click.stop="favoriteWallpaper">
                {{ isContextMenuItemFavorited ? '已收藏' : '收藏此壁纸' }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
    thumbs?: string[]
    favorited?: boolean[]
    current_wallpaper: string
}
const props = withDefaults(defineProps<Props>(), {
    current_wallpaper: "",
    thumbs: () => [],
    favorited: () => [],
})
const emit = defineEmits<{
    (e: 'selectWallpaper', index: number): void
    (e: 'favoriteWallpaper', index: number): void
}>()
const wallpaperCarouselRef = ref<HTMLDivElement | null>(null)
const contextMenu = ref({
    visible: false,
    index: -1,
    x: 0,
    y: 0,
})

const isContextMenuItemFavorited = computed(() => {
    return props.favorited[contextMenu.value.index] ?? false
})

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

const openContextMenu = (event: MouseEvent, index: number) => {
    contextMenu.value = {
        visible: true,
        index,
        x: event.clientX,
        y: event.clientY,
    }
}

const closeContextMenu = () => {
    contextMenu.value.visible = false
}

const favoriteWallpaper = () => {
    if (isContextMenuItemFavorited.value) {
        closeContextMenu()
        return
    }

    if (contextMenu.value.index >= 0) {
        emit('favoriteWallpaper', contextMenu.value.index)
    }

    closeContextMenu()
}
</script>

<style lang="scss" scoped>
.wallpaper-carousel {
    width: 100%;
    height: 140px;
    background-color: white;
    display: flex;
    overflow-y: hidden;
    overflow-x: auto;
    position: relative;

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

.context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 140px;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    background-color: rgba(34, 34, 34, 0.95);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.35);

    button {
        width: 100%;
        height: 34px;
        padding: 0 12px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #fff;
        text-align: left;
        cursor: pointer;

        &:disabled {
            cursor: default;
            color: rgba(255, 255, 255, 0.58);
        }

        &:not(:disabled):hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
    }
}
</style>