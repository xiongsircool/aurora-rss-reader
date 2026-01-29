// Electron API 类型定义
export interface UpdateInfo {
  version: string
  releaseDate: string
  files: Array<{
    url: string
    sha512: string
    size: number
  }>
  path: string
  sha512: string
}

export interface UpdateDownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateError {
  message: string
  stack?: string
}

// 扩展 Window 接口
declare global {
  interface Window {
    ipcRenderer?: {
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
      off: (channel: string, listener: (...args: unknown[]) => void) => void
      send: (channel: string, ...args: unknown[]) => void
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
    electron?: {
      // 检查更新
      checkForUpdates: () => Promise<{ success: boolean; error?: string }>

      // 获取应用版本
      getAppVersion: () => Promise<string>

      // 监听更新事件
      onUpdateChecking: (callback: () => void) => () => void
      onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
      onUpdateDownloadStarted: (callback: (info: UpdateInfo) => void) => () => void
      onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void
      onUpdateDownloadCompleted: (callback: (info: UpdateInfo) => void) => () => void
      onUpdateError: (callback: (error: UpdateError) => void) => () => void
    }
  }
}

export {}
