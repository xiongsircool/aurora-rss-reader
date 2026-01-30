import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog, shell } from 'electron'
import log from 'electron-log'

// 配置日志
autoUpdater.logger = log
log.transports.file.level = 'info'

// 配置更新选项
autoUpdater.autoDownload = false  // 不自动下载，让用户选择
autoUpdater.autoInstallOnAppQuit = true  // 退出时自动安装

// 跳过版本列表（用户手动跳过的版本）
let skippedVersions: Set<string> = new Set()

// 标记是否为手动检查更新（用于区分错误提示）
let isManualCheck = false

/**
 * 设置自动更新器
 * @param mainWindow 主窗口实例
 */
export function setupAutoUpdater(mainWindow: BrowserWindow) {
  log.info('🔄 初始化自动更新器')

  // 开发环境下禁用自动更新
  if (process.env.NODE_ENV === 'development') {
    log.info('⚠️  开发环境，跳过自动更新')
    return
  }

  // ========================================
  // 1️⃣ 检查更新（启动后 5 秒延迟）
  // ========================================
  setTimeout(() => {
    log.info('🔍 开始检查更新...')
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('❌ 检查更新失败:', err)
      // 静默处理错误，不弹窗打扰用户
      // 常见原因: 网络问题、旧版本缺少 latest-mac.yml 文件
    })
  }, 5000)

  // ========================================
  // 2️⃣ 发现新版本
  // ========================================
  autoUpdater.on('update-available', (info) => {
    log.info('✨ 发现新版本:', info.version)
    log.info('📅 发布日期:', info.releaseDate)
    log.info('📦 文件信息:', info.files)

    // 检查是否已被用户跳过
    if (skippedVersions.has(info.version)) {
      log.info(`⏭️  版本 ${info.version} 已被用户跳过`)
      return
    }

    const currentVersion = autoUpdater.currentVersion.version
    const releaseDate = new Date(info.releaseDate).toLocaleDateString('zh-CN')

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}`,
        detail: [
          `当前版本: ${currentVersion}`,
          `发布日期: ${releaseDate}`,
          '',
          '是否立即下载并安装？',
        ].join('\n'),
        buttons: ['立即下载', '查看更新日志', '稍后提醒', '跳过此版本'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      })
      .then((result) => {
        switch (result.response) {
          case 0:
            // 立即下载
            log.info('📥 用户选择立即下载')
            autoUpdater.downloadUpdate()
            // 通知渲染进程开始下载
            mainWindow.webContents.send('update-download-started', info)
            break
          case 1:
            // 查看更新日志
            log.info('📄 用户选择查看更新日志')
            shell.openExternal(
              `https://github.com/xiongsircool/aurora-rss-reader/releases/tag/v${info.version}`
            )
            break
          case 2:
            // 稍后提醒
            log.info('⏰ 用户选择稍后提醒')
            break
          case 3:
            // 跳过此版本
            log.info(`⏭️  用户选择跳过版本 ${info.version}`)
            skippedVersions.add(info.version)
            break
        }
      })
      .catch((err) => {
        log.error('❌ 显示更新对话框失败:', err)
      })
  })

  // ========================================
  // 3️⃣ 无可用更新
  // ========================================
  autoUpdater.on('update-not-available', (info) => {
    log.info('✅ 当前已是最新版本:', info.version)
  })

  // ========================================
  // 4️⃣ 下载进度
  // ========================================
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = progressObj.percent.toFixed(1)
    const transferred = (progressObj.transferred / 1024 / 1024).toFixed(2)
    const total = (progressObj.total / 1024 / 1024).toFixed(2)
    const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2)

    const logMsg = `⬇️  下载进度: ${percent}% (${transferred}MB / ${total}MB) - ${speed} MB/s`
    log.info(logMsg)

    // 发送进度到渲染进程
    mainWindow.webContents.send('update-download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    })
  })

  // ========================================
  // 5️⃣ 下载完成
  // ========================================
  autoUpdater.on('update-downloaded', (info) => {
    log.info('✅ 更新已下载完成:', info.version)
    log.info('📦 下载文件:', info.files)

    // 通知渲染进程下载完成
    mainWindow.webContents.send('update-download-completed', info)

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: '更新已下载',
        message: `新版本 ${info.version} 已下载完成`,
        detail: '应用将在重启后自动更新。\n\n您可以立即重启，或稍后手动重启应用。',
        buttons: ['立即重启', '稍后重启'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 0) {
          log.info('🔄 用户选择立即重启并安装更新')
          // 退出并安装
          // 参数: (isSilent=false, isForceRunAfter=true)
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true)
          })
        } else {
          log.info('⏰ 用户选择稍后重启')
        }
      })
      .catch((err) => {
        log.error('❌ 显示重启对话框失败:', err)
      })
  })

  // ========================================
  // 6️⃣ 错误处理
  // ========================================
  autoUpdater.on('error', (err) => {
    log.error('❌ 自动更新错误:', err)

    // 通知渲染进程错误
    mainWindow.webContents.send('update-error', {
      message: err.message,
      stack: err.stack,
    })

    // 如果是自动检查更新且是 404 错误（旧版本缺少 latest-mac.yml），静默处理
    if (!isManualCheck && err.message.includes('404')) {
      log.warn('⚠️  当前版本可能缺少更新清单文件，静默跳过（不弹窗）')
      return
    }

    // 只在手动检查更新时才弹窗提示错误
    if (!isManualCheck) {
      log.warn('⚠️  自动检查更新失败，静默处理（不打扰用户）')
      return
    }

    // 判断错误类型
    let errorMessage = '检查更新时出错，请稍后重试'
    let errorDetail = err.message

    if (err.message.includes('404')) {
      errorMessage = '更新服务暂不可用'
      errorDetail = '当前版本可能过旧，请访问 GitHub 手动下载最新版本'
    } else if (err.message.includes('net::')) {
      errorMessage = '网络连接失败'
      errorDetail = '无法连接到更新服务器，请检查网络连接后重试'
    } else if (err.message.includes('sha512')) {
      errorMessage = '文件校验失败'
      errorDetail = '下载的文件可能已损坏，请重新下载'
    } else if (err.message.includes('ENOSPC')) {
      errorMessage = '磁盘空间不足'
      errorDetail = '请清理磁盘空间后重试'
    }

    dialog
      .showMessageBox(mainWindow, {
        type: 'warning',
        title: '更新检查失败',
        message: errorMessage,
        detail: errorDetail,
        buttons: ['手动下载', '关闭'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 0) {
          // 手动下载
          shell.openExternal('https://github.com/xiongsircool/aurora-rss-reader/releases/latest')
        }
      })
      .catch((err) => {
        log.error('❌ 显示错误对话框失败:', err)
      })
  })

  // ========================================
  // 7️⃣ 检查更新前
  // ========================================
  autoUpdater.on('checking-for-update', () => {
    log.info('🔍 正在检查更新...')
    mainWindow.webContents.send('update-checking')
  })
}

/**
 * 手动检查更新
 * @param mainWindow 主窗口实例
 */
export function checkForUpdatesManually(mainWindow: BrowserWindow) {
  log.info('🔍 用户手动检查更新')

  // 标记为手动检查（影响错误处理逻辑）
  isManualCheck = true

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      if (!result) {
        log.info('✅ 当前已是最新版本')
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '当前已是最新版本',
          detail: `版本号: ${autoUpdater.currentVersion.version}`,
          buttons: ['确定'],
        })
      }
    })
    .catch((err) => {
      log.error('❌ 手动检查更新失败:', err)
      // 错误会在 autoUpdater.on('error') 中统一处理
    })
    .finally(() => {
      // 重置标记
      isManualCheck = false
    })
}

/**
 * 获取当前版本号
 */
export function getCurrentVersion(): string {
  return autoUpdater.currentVersion.version
}

/**
 * 清除跳过的版本列表
 */
export function clearSkippedVersions() {
  log.info('🧹 清除跳过的版本列表')
  skippedVersions.clear()
}
