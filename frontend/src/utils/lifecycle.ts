// 应用生命周期管理
//
// Neutralino 的每个 window.create 都会启动一个完全独立的进程（隔离 app 实例），
// app.exit() / app.broadcast() 都无法跨进程作用，官方的 singleInstance 配置也尚未实现。
// 因此这里通过 PID 文件 + 进程存活检测来实现跨进程的“单例”与“主进程退出时一并退出”。
// 依赖 POSIX shell（ps / echo $PPID），面向 Linux 桌面环境。

import { closeConfigWindow } from './config'

const LOCK_FILE = 'wallpaper-manager.lock'
const FOCUS_FILE = 'wallpaper-manager.focus'

const execOut = async (command: string): Promise<string> => {
    const res = await Neutralino.os.execCommand(command)
    return res.stdOut.trim()
}

// 判断某个 PID 是否仍然存活且可用。
// 注意：不能用 `kill -0`，因为设置窗口是主进程 spawn 的子进程，退出后会变成
// 僵尸进程（defunct），此时 kill -0 仍返回存活，导致单例判断误判、无法重新打开。
// 这里用 ps 读取进程状态，排除僵尸态（Z）。
export const isPidAlive = async (pid: number): Promise<boolean> => {
    if (!pid || Number.isNaN(pid)) return false
    const state = await execOut(`ps -o state= -p ${pid} 2>/dev/null`)
    return state !== '' && !state.startsWith('Z')
}

const lockPath = async (): Promise<string> => {
    const dir = await Neutralino.os.getPath('data')
    return `${dir}/${LOCK_FILE}`
}

const focusPath = async (): Promise<string> => {
    const dir = await Neutralino.os.getPath('data')
    return `${dir}/${FOCUS_FILE}`
}

// 主进程请求把已打开的设置窗口置顶（跨进程无法直接聚焦别的窗口，
// 通过写入信号文件，由设置窗口自己聚焦自身）。
export const requestConfigFocus = async (): Promise<void> => {
    try {
        await Neutralino.filesystem.writeFile(await focusPath(), String(Date.now()))
    } catch {
        // 忽略写入失败
    }
}

// 当前窗口是否是设置窗口（由 window.create 以 /#/config 打开）
export const isConfigWindow = (): boolean =>
    location.hash.startsWith('#/config') ||
    (window.NL_ARGS || []).includes('--window-config')

// 主窗口启动时保证应用单例。若已有存活实例，退出当前实例并返回 false。
export const ensureSingleInstance = async (): Promise<boolean> => {
    const path = await lockPath()

    try {
        const pid = parseInt((await Neutralino.filesystem.readFile(path)).trim(), 10)
        if (await isPidAlive(pid)) {
            await Neutralino.app.exit()
            return false
        }
    } catch {
        // 锁文件不存在，属于首个实例
    }

    const ownPid = await execOut('echo $PPID')
    await Neutralino.filesystem.writeFile(path, ownPid)
    return true
}

// 设置窗口的运行时逻辑：
// 1）轮询主进程存活状态，主进程退出后自行退出（关主窗口 / 托盘退出 → 设置窗口一并关闭）；
// 2）响应主进程的置顶请求，把自己聚焦到最前。
export const setupConfigWindow = async (intervalMs = 400): Promise<void> => {
    let parentPid = 0
    try {
        parentPid = parseInt((await Neutralino.filesystem.readFile(await lockPath())).trim(), 10)
    } catch {
        // 无法定位主进程，保持窗口打开更安全
    }

    // 记录当前置顶信号，避免打开瞬间误触发聚焦
    let lastFocusToken = ''
    try {
        lastFocusToken = (await Neutralino.filesystem.readFile(await focusPath())).trim()
    } catch {
        // 尚无置顶信号
    }

    const parentAlive = parentPid ? await isPidAlive(parentPid) : false

    let exiting = false
    const timer = setInterval(async () => {
        if (exiting) return

        // 处理置顶请求
        try {
            const token = (await Neutralino.filesystem.readFile(await focusPath())).trim()
            if (token && token !== lastFocusToken) {
                lastFocusToken = token
                try { await Neutralino.window.show() } catch { /* 已显示 */ }
                await Neutralino.window.focus()
            }
        } catch {
            // 信号文件不存在，忽略
        }

        // 主进程退出后自行退出
        if (parentAlive && !(await isPidAlive(parentPid))) {
            exiting = true
            clearInterval(timer)
            await Neutralino.app.exit()
        }
    }, intervalMs)
}

// 退出整个应用：先关掉设置窗口进程，再退出主进程。
// 用守卫保证只执行一次：app.exit() 会触发 windowClose 事件再次进入本函数，
// 若重复执行会在正在关闭的 websocket 上再发原生调用，导致 websocketpp invalid state 崩溃。
let quitting = false
export const quitApp = async (): Promise<void> => {
    if (quitting) return
    quitting = true
    try {
        await closeConfigWindow()
    } catch {
        // 忽略关闭设置窗口时的异常，继续退出主进程
    }
    try {
        // 运行时为 Neutralino 6.8，filesystem.remove 存在，但当前类型包版本较旧未声明
        await (Neutralino.filesystem as any).remove(await lockPath())
    } catch {
        // 锁文件可能已不存在
    }
    await Neutralino.app.exit()
}
