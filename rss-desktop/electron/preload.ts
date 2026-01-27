import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// --------- Expose Electron-specific APIs ---------
contextBridge.exposeInMainWorld('electron', {
  // 检查更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 监听更新事件
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', callback)
    return () => ipcRenderer.removeListener('update-checking', callback)
  },

  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info))
    return () => ipcRenderer.removeAllListeners('update-available')
  },

  onUpdateDownloadStarted: (callback: (info: any) => void) => {
    ipcRenderer.on('update-download-started', (_event, info) => callback(info))
    return () => ipcRenderer.removeAllListeners('update-download-started')
  },

  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('update-download-progress')
  },

  onUpdateDownloadCompleted: (callback: (info: any) => void) => {
    ipcRenderer.on('update-download-completed', (_event, info) => callback(info))
    return () => ipcRenderer.removeAllListeners('update-download-completed')
  },

  onUpdateError: (callback: (error: any) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error))
    return () => ipcRenderer.removeAllListeners('update-error')
  },
})

