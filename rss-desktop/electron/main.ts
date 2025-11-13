import { app, BrowserWindow } from 'electron'
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

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let backendProcess: ChildProcess | null = null
let backendReady = false

const isDev = VITE_DEV_SERVER_URL !== undefined
const projectRoot = path.join(process.env.APP_ROOT, '..')
const backendDir = path.join(projectRoot, 'backend')

// 后端配置
const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 15432
const HEALTH_CHECK_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/health`
const HEALTH_CHECK_TIMEOUT = 30000 // 30秒超时
const HEALTH_CHECK_INTERVAL = 500 // 每500ms检查一次

/**
 * 健康检查：等待后端服务就绪
 */
async function waitForBackendReady(): Promise<boolean> {
  const startTime = Date.now()

  console.log(`⏳ 等待后端服务就绪... (${HEALTH_CHECK_URL})`)

  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2秒超时
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ 后端服务已就绪:', data)
        backendReady = true
        return true
      }
    } catch (error) {
      // 忽略连接错误，继续重试
    }

    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
  }

  console.error('❌ 后端服务启动超时')
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
async function startBackend(): Promise<boolean> {
  if (backendProcess) {
    console.log('⚠️  后端已在运行')
    return backendReady
  }

  try {
    const { exec, args, cwd } = getBackendExecutable()

    console.log('🚀 启动后端服务...')
    console.log(`   可执行文件: ${exec}`)
    console.log(`   参数: ${args.join(' ')}`)
    console.log(`   工作目录: ${cwd}`)

    const spawnOptions: any = {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        APP_ENV: isDev ? 'development' : 'production',
        // 设置数据目录（可选，后端会自动处理）
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
        if (output) console.log('[Backend]', output)
      })

      spawnedProcess.stderr?.on('data', (data) => {
        const output = data.toString().trim()
        if (output) console.error('[Backend Error]', output)
      })
    }

    spawnedProcess.on('error', (error) => {
      console.error('❌ 后端进程错误:', error)
      backendProcess = null
      backendReady = false
    })

    spawnedProcess.on('exit', (code, signal) => {
      console.log(`[Backend] 进程退出 - 代码: ${code}, 信号: ${signal}`)
      backendProcess = null
      backendReady = false
    })

    console.log('✅ 后端进程已启动，等待服务就绪...')

    // 等待后端服务就绪
    const ready = await waitForBackendReady()

    if (!ready) {
      console.error('❌ 后端服务未能在规定时间内就绪')
      stopBackend()
      return false
    }

    return true

  } catch (error) {
    console.error('❌ 启动后端时发生错误:', error)
    backendProcess = null
    backendReady = false
    return false
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
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    show: false, // 先不显示，等加载完成后再显示
    icon: path.join(process.env.VITE_PUBLIC || '', 'icons', 'app-release.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 窗口加载完成后显示
  win.once('ready-to-show', () => {
    win?.show()
    if (isDev) {
      win?.webContents.openDevTools()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

/**
 * 应用启动
 */
app.whenReady().then(async () => {
  console.log('🎯 Aurora RSS Reader 启动中...')
  console.log(`   开发模式: ${isDev}`)
  console.log(`   用户数据目录: ${app.getPath('userData')}`)
  console.log(`   资源路径: ${process.resourcesPath}`)

  // 开发模式下，假设后端已由 pnpm dev 启动
  if (isDev) {
    console.log('⚠️  开发模式：假设后端已由 pnpm dev 启动')
    console.log('   等待后端就绪...')

    const backendReady = await waitForBackendReady()

    if (!backendReady) {
      console.error('❌ 后端未就绪，请确保运行了 pnpm dev')
      console.error('   或者单独启动后端: cd backend && source .venv/bin/activate && python -m scripts.serve')
      app.quit()
      return
    }

    // 后端就绪，直接创建窗口
    createWindow()
  } else {
    // 生产模式：需要启动后端
    const backendStarted = await startBackend()

    if (!backendStarted) {
      console.error('❌ 后端启动失败，应用无法继续')
      app.quit()
      return
    }

    // 后端就绪后创建窗口
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
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
