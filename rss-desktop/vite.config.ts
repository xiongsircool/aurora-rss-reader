import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import UnoCSS from 'unocss/vite'

// Custom plugin to build preload with esbuild (ensures CJS format)
function buildPreloadPlugin() {
  return {
    name: 'build-preload',
    buildStart() {
      execSync('npx esbuild electron/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs', {
        stdio: 'inherit'
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    vue(),
    UnoCSS(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          plugins: [buildPreloadPlugin()]
        }
      },
    ]),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:15432',
        changeOrigin: true,
        secure: false,
      }
    }
  },
})
