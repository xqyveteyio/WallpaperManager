import { isPidAlive, requestConfigFocus } from './lifecycle'

// 记录设置窗口进程，用于单例判断与主动关闭
let configPid: number | null = null

export const openConfigWindow = async (): Promise<void> => {
    // 单例：已有存活的设置窗口时把它置顶，不再新建
    if (configPid !== null && (await isPidAlive(configPid))) {
        await requestConfigFocus()
        return
    }

    const proc = await Neutralino.window.create('/#/config', {
        title: '设置',
        width: 500,
        height: 350,
        maximizable: false,
        exitProcessOnClose: true,
        processArgs: '--window-config',
    })
    configPid = proc.pid
}

// 关闭设置窗口进程（若存在）
export const closeConfigWindow = async (): Promise<void> => {
    if (configPid !== null && (await isPidAlive(configPid))) {
        await Neutralino.os.execCommand(`kill ${configPid}`)
    }
    configPid = null
}
