import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        component: () => import('@/views/HomeView.vue')
    },
    {
        path: '/config',
        component: () => import('@/views/ConfigView.vue')
    },
    // {
    //     path: '/about',
    //     component: () => import('@/views/AboutView.vue')
    // }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router
