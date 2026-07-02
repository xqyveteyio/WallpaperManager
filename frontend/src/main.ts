import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import router from './router'
import { ensureSingleInstance, isConfigWindow, setupConfigWindow } from './utils/lifecycle'

createApp(App).use(router).mount('#app');
(async () => {
    if (!window.NL_PORT) {
        const config = await import('./auth_info.json') // Make sure you successfully created a symlink for the auth_info (step 6 in README)
        window.NL_PORT = config.port
        window.NL_TOKEN = config.accessToken
    }

    Neutralino.init()
    Neutralino.events.on('ready', async () => {
        if (isConfigWindow()) {
            // 设置窗口：跟随主进程退出 + 响应置顶
            await setupConfigWindow()
        } else {
            // 主窗口：保证应用单例
            await ensureSingleInstance()
        }
    })
})()