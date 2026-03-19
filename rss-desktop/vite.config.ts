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

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (
    id.includes('/vue/dist/') ||
    id.includes('/node_modules/vue/') ||
    id.includes('/node_modules/@vue/')
  ) {
    return 'vue-core'
  }

  if (
    id.includes('/node_modules/pinia/') ||
    id.includes('/node_modules/vue-router/') ||
    id.includes('/node_modules/vue-i18n/')
  ) {
    return 'app-framework'
  }

  if (
    id.includes('/node_modules/marked/')
  ) {
    return 'markdown-core'
  }

  if (id.includes('/node_modules/dompurify/')) {
    return 'html-sanitize'
  }

  if (id.includes('/node_modules/katex/')) {
    return 'math-render'
  }

  if (id.includes('/node_modules/vue-virtual-scroller/')) {
    return 'virtual-scroller'
  }

  if (
    id.includes('/node_modules/dayjs/') ||
    id.includes('/node_modules/axios/') ||
    id.includes('/node_modules/@vueuse/core/')
  ) {
    return 'app-utils'
  }

  return 'vendor'
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
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      }
    }
  },
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
