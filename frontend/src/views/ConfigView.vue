<template>
    <div class="config-window">
        <h1>Config Window</h1>
        <button @click="test++">Click me</button>
        <p>{{ test }}111</p>
    </div>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';
const test = ref(0);
console.log("114514");

onMounted(async () => {
    alert(1145)
    await Neutralino.storage.setData('userDetails',
        JSON.stringify({ username: 'TestValue' })
    );
    const userDetails = await Neutralino.storage.getData('userDetails');
    console.log(userDetails);
});
</script>

<style scoped lang="scss">
.config-window {
    width: 100vw;
    height: 100vh;
    background-color: #fff;
}
</style>