import axios from 'axios'
import { getApiBaseUrl } from './base'

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
})

export default api
