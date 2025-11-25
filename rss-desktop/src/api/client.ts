import axios from 'axios'

const api = axios.create({
  // 默认生产后端端口 27495，开发环境可用 VITE_API_BASE_URL 覆盖
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:27495/api',
  timeout: 15000,
})

export default api
