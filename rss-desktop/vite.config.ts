import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
      },
    ]),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      }
    }
  },
})
