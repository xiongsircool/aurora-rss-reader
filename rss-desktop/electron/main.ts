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

const projectRoot = path.join(process.env.APP_ROOT, '..')
const backendDir = path.join(projectRoot, 'backend')

function resolvePythonExecutable() {
  if (process.env.BACKEND_PYTHON) return process.env.BACKEND_PYTHON
  const venvPath = process.platform === 'win32'
    ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python3')
  if (fs.existsSync(venvPath)) return venvPath
  return process.platform === 'win32' ? 'python' : 'python3'
}

function startBackend() {
  if (backendProcess) return
  const pythonExec = resolvePythonExecutable()
  const spawnedProcess = spawn(pythonExec, ['-m', 'scripts.serve'], {
    cwd: backendDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: 'inherit',
  })
  backendProcess = spawnedProcess
  spawnedProcess.on('exit', (code) => {
    backendProcess = null
    console.log('[backend] exited with code', code)
  })
}

function stopBackend() {
  if (!backendProcess) return
  backendProcess.kill()
  backendProcess = null
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'aurora-icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

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

app.whenReady().then(() => {
  startBackend()
  createWindow()
})

app.on('quit', () => {
  stopBackend()
})
