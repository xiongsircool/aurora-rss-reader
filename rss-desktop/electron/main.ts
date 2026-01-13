import { app, BrowserWindow, dialog } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')
// 日志文件路径
const logFile = path.join(app.getPath('userData'), 'desktop_startup.log')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let backendProcess: ChildProcess | null = null
let backendReady = false

const PRELOAD_PATH = resolvePreloadPath()
const isDev = VITE_DEV_SERVER_URL !== undefined
const projectRoot = path.join(process.env.APP_ROOT, '..')
const backendDir = path.join(projectRoot, 'backend')
let devtoolsOpened = false

// 后端配置
const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 15432
const HEALTH_CHECK_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/health`
const HEALTH_CHECK_TIMEOUT = 30000 // 30秒超时
const HEALTH_CHECK_INTERVAL = 500 // 每500ms检查一次

function resolvePreloadPath(): string {
  const candidates = ['preload.mjs', 'preload.js', 'preload.cjs']

  for (const name of candidates) {
    const candidate = path.join(__dirname, name)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  const fallback = path.join(__dirname, 'preload.js')
  console.warn('⚠️  未找到预设的 preload 文件，回退到', fallback)
  return fallback
}


function logToFile(message: string) {
  const time = new Date().toISOString()
  const logMessage = `[${time}] ${message}`
  console.log(logMessage)
  try {
    fs.appendFileSync(logFile, logMessage + '\n')
  } catch (err) {
    console.error('Failed to write log:', err)
  }
}

/**
 * 健康检查：等待后端服务就绪
 */
async function waitForBackendReady(): Promise<boolean> {
  const startTime = Date.now()

  logToFile(`⏳ 等待后端服务就绪... (${HEALTH_CHECK_URL})`)

  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2秒超时
      })

      if (response.ok) {
        const data = await response.json()
        logToFile(`✅ 后端服务已就绪: ${JSON.stringify(data)}`)
        backendReady = true
        return true
      }
    } catch (error) {
      // 忽略连接错误，继续重试
    }

    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
  }

  logToFile('❌ 后端服务启动超时')
  return false
}

/**
 * 获取后端可执行文件路径
 */
function getBackendExecutable(): { exec: string; args: string[]; cwd: string } {
  if (isDev) {
    // 开发环境：使用Python虚拟环境
    const venvPath = process.platform === 'win32'
      ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
      : path.join(backendDir, '.venv', 'bin', 'python3')

    const pythonExec = fs.existsSync(venvPath)
      ? venvPath
      : (process.platform === 'win32' ? 'python' : 'python3')

    console.log('🔧 开发环境，使用Python:', pythonExec)

    return {
      exec: pythonExec,
      args: ['-m', 'scripts.serve'],
      cwd: backendDir
    }
  } else {
    // 生产环境：使用打包好的后端可执行文件
    // 尝试多个可能的路径
    const possiblePaths = [
      // 方式1: 在 app.asar 同级的 resources 目录
      path.join(process.resourcesPath, 'backend', 'aurora-backend'),
      // 方式2: 在 APP_ROOT 的 backend 目录
      path.join(process.env.APP_ROOT || '', 'backend', 'aurora-backend'),
      // 方式3: 在应用目录
      path.join(path.dirname(app.getPath('exe')), 'backend', 'aurora-backend'),
    ]

    // Windows 添加 .exe 后缀
    if (process.platform === 'win32') {
      possiblePaths.forEach((p, i) => {
        possiblePaths[i] = p + '.exe'
      })
    }

    console.log('🔍 搜索后端可执行文件...')
    for (const backendPath of possiblePaths) {
      console.log(`   检查: ${backendPath}`)
      if (fs.existsSync(backendPath)) {
        console.log(`✅ 找到后端: ${backendPath}`)

        // 确保文件有执行权限 (Unix系统)
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(backendPath, 0o755)
          } catch (err) {
            console.warn('⚠️  无法设置执行权限:', err)
          }
        }

        return {
          exec: backendPath,
          args: [],
          cwd: path.dirname(backendPath)
        }
      }
    }

    console.error('❌ 找不到后端可执行文件，搜索路径:', possiblePaths)
    throw new Error('Backend executable not found in any expected location')
  }
}

/**
 * 启动后端服务
 */
/**
 * 启动后端服务
 */
async function startBackend(): Promise<{ success: boolean; error?: string; path?: string }> {
  if (backendProcess) {
    logToFile('⚠️  后端已在运行')
    return { success: backendReady }
  }

  // [DEBUG] Ensure error dialog is active
  let execPath = ''

  try {
    logToFile('Finding backend executable...')
    try {
      const { exec, args, cwd } = getBackendExecutable()
      execPath = exec

      logToFile('🚀 启动后端服务...')
      logToFile(`   可执行文件: ${exec}`)
      logToFile(`   参数: ${args.join(' ')}`)
      logToFile(`   工作目录: ${cwd}`)

      const spawnOptions: any = {
        cwd,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          APP_ENV: isDev ? 'development' : 'production',
          AURORA_DATA_DIR: app.getPath('userData')
        },
        stdio: isDev ? 'inherit' : ['pipe', 'pipe', 'pipe'] as const
      }

      const spawnedProcess = spawn(exec, args, spawnOptions)
      backendProcess = spawnedProcess

      // 记录后端输出
      if (!isDev) {
        spawnedProcess.stdout?.on('data', (data) => {
          const output = data.toString().trim()
          if (output) logToFile(`[Backend] ${output}`)
        })

        spawnedProcess.stderr?.on('data', (data) => {
          const output = data.toString().trim()
          if (output) logToFile(`[Backend Error] ${output}`)
        })
      }

      spawnedProcess.on('error', (error) => {
        logToFile(`❌ 后端进程错误: ${error}`)
        backendProcess = null
        backendReady = false
      })

      spawnedProcess.on('exit', (code, signal) => {
        logToFile(`[Backend] 进程退出 - 代码: ${code}, 信号: ${signal}`)
        backendProcess = null
        backendReady = false
      })

      logToFile('✅ 后端进程已启动，等待服务就绪...')

      const ready = await waitForBackendReady()

      if (!ready) {
        logToFile('❌ 后端服务未能在规定时间内就绪')
        stopBackend()
        return { success: false, error: '后端服务启动超时（30s）', path: execPath }
      }

      return { success: true, path: execPath }

    } catch (err: any) {
      // getBackendExecutable throw error
      return { success: false, error: err.message || String(err), path: '搜索失败' }
    }

  } catch (error: any) {
    logToFile(`❌ 启动后端时发生错误: ${error}`)
    backendProcess = null
    backendReady = false
    return { success: false, error: error.message || String(error), path: execPath }
  }
}

/**
 * 停止后端服务
 */
function stopBackend() {
  if (!backendProcess) return

  console.log('🛑 停止后端服务...')

  try {
    backendProcess.kill('SIGTERM')

    // 如果5秒后还没退出，强制杀死
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        console.warn('⚠️  强制终止后端进程')
        backendProcess.kill('SIGKILL')
      }
    }, 5000)
  } catch (error) {
    console.error('❌ 停止后端时出错:', error)
  }

  backendProcess = null
  backendReady = false
}

/**
 * 创建主窗口
 */
function createWindow() {
  // 如果有已存在但已销毁的窗口句柄，清空引用
  if (win?.isDestroyed?.() === true) {
    win = null
  }

  // 复用尚未销毁的窗口
  if (win) return win

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    show: false, // 先不显示，等加载完成后再显示
    icon: path.join(process.env.VITE_PUBLIC || '', 'icons', 'app-release.png'),
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // macOS 用户关闭窗口（不退出）时，BrowserWindow 会被销毁。
  // 清空引用，避免后续对已销毁对象调用 loadURL/loadFile 导致
  // "TypeError: Object has been destroyed"
  win.on('closed', () => {
    win = null
  })

  // 窗口加载完成后显示
  win.once('ready-to-show', () => {
    win?.show()
  })

  win.webContents.on('did-finish-load', () => {
    const currentURL = win?.webContents.getURL() || ''

    if (isLoadingScreen(currentURL)) {
      return
    }

    win?.webContents.send('main-process-message', new Date().toLocaleString())

    if (isDev && !devtoolsOpened) {
      win?.webContents.openDevTools()
      devtoolsOpened = true
    }
  })

  return win
}

function isLoadingScreen(url: string) {
  return url.startsWith('data:text/html')
}

function showStartupStatus(message: string) {
  if (!win) return

  // 确保窗口没有被销毁
  if (win.isDestroyed && win.isDestroyed()) {
    win = null
    return
  }

  const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = /* html */ `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>Aurora RSS Reader</title>
        <style>
          :root {
            color-scheme: light dark;
          }
          body {
            margin: 0;
            display: flex;
            height: 100vh;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a;
            color: #f8fafc;
          }
          .card {
            text-align: center;
          }
          .status {
            margin-top: 12px;
            font-size: 16px;
            color: #cbd5f5;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Aurora RSS Reader</h2>
          <div class="status">${safeMessage}</div>
        </div>
      </body>
    </html>
  `

  try {
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  } catch (error) {
    console.error('Failed to load startup status:', error)
    // 如果加载失败，可能窗口已被销毁，重置引用
    win = null
  }
}

function loadRendererContent() {
  if (!win) return

  // 检查窗口是否已销毁
  if (win.isDestroyed && win.isDestroyed()) {
    win = null
    return
  }

  try {
    if (VITE_DEV_SERVER_URL) {
      win.loadURL(VITE_DEV_SERVER_URL)
    } else {
      win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
  } catch (error) {
    console.error('Failed to load renderer content:', error)
    // 如果加载失败，可能窗口已被销毁，重置引用
    win = null
  }
}

/**
 * 应用启动
 */
app.whenReady().then(async () => {
  logToFile('🎯 Aurora RSS Reader 启动中...')
  logToFile(`   开发模式: ${isDev}`)
  logToFile(`   用户数据目录: ${app.getPath('userData')}`)
  logToFile(`   资源路径: ${process.resourcesPath}`)

  createWindow()

  if (isDev) {
    logToFile('⚠️  开发模式：假设后端已由 pnpm dev 启动')
    logToFile('   等待后端就绪...')
    showStartupStatus('等待开发后端服务就绪...')

    const backendReady = await waitForBackendReady()

    if (!backendReady) {
      logToFile('❌ 后端未就绪，请确保运行了 pnpm dev')
      dialog.showErrorBox('启动失败', '开发模式后端未就绪，请确保运行了 pnpm dev')
      showStartupStatus('后端未就绪，请检查终端中的启动命令')
      app.quit()
      return
    }

    loadRendererContent()
  } else {
    showStartupStatus('正在启动后端服务，请稍候...')

    const backendResult = await startBackend()

    if (!backendResult.success) {
      logToFile(`❌ 后端启动失败: ${backendResult.error}`)
      dialog.showErrorBox('后端启动失败',
        `错误详情: ${backendResult.error}\n\n` +
        `搜索路径: ${backendResult.path || '未知'}\n\n` +
        `请截图反馈此问题。`
      )
      showStartupStatus(`后端启动失败: ${backendResult.error}`)
      app.quit()
      return
    }

    loadRendererContent()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // macOS: 当用户点击 dock 图标时，如果没有窗口则创建新窗口
  // 检查是否有任何可见的窗口（排除已销毁的窗口）
  const visibleWindows = BrowserWindow.getAllWindows().filter(window => !window.isDestroyed())

  if (visibleWindows.length === 0) {
    // 没有可见窗口，创建新窗口
    createWindow()
    if (backendReady) {
      loadRendererContent()
    } else {
      showStartupStatus('正在等待后端服务...')
    }
  } else {
    // 有可见窗口，将其显示到前台
    const mainWindow = visibleWindows[0]
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  }
})

app.on('before-quit', () => {
  // 只在生产模式下停止后端（开发模式下后端由 pnpm dev 管理）
  if (!isDev) {
    stopBackend()
  }
})

app.on('quit', () => {
  // 只在生产模式下停止后端
  if (!isDev) {
    stopBackend()
  }
})
