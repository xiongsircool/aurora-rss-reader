import { ref } from 'vue'
import api from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'

export interface ProxyStatusResult {
  mode: 'system' | 'custom' | 'off'
  configured_url: string
  effective_url: string | null
  env_proxy_url: string | null
  system_proxy_url: string | null
  source: 'disabled' | 'custom' | 'environment' | 'system' | 'none' | 'custom-invalid'
  active: boolean
  valid: boolean
}

export function useProxySettings() {
  const settingsStore = useSettingsStore()
  const proxyMode = ref<'system' | 'custom' | 'off'>(settingsStore.settings.outbound_proxy_mode)
  const proxyUrl = ref(settingsStore.settings.outbound_proxy_url)
  const proxyStatus = ref<ProxyStatusResult | null>(null)
  const proxyStatusLoading = ref(false)
  const proxyError = ref('')

  async function fetchProxyStatus() {
    proxyStatusLoading.value = true

    try {
      const { data } = await api.get<ProxyStatusResult>('/settings/proxy-status')
      proxyStatus.value = data
      proxyError.value = ''
      return data
    } catch (error) {
      console.error('获取代理状态失败:', error)
      proxyError.value = '获取代理状态失败'
      return null
    } finally {
      proxyStatusLoading.value = false
    }
  }

  async function commitProxySettings(): Promise<boolean> {
    const trimmedUrl = proxyUrl.value.trim()

    if (proxyMode.value === 'custom' && !trimmedUrl) {
      proxyError.value = '请输入代理地址'
      return false
    }

    try {
      await settingsStore.updateSettings({
        outbound_proxy_mode: proxyMode.value,
        outbound_proxy_url: proxyMode.value === 'custom' ? trimmedUrl : ''
      })
      proxyError.value = ''
      proxyUrl.value = proxyMode.value === 'custom' ? trimmedUrl : ''
      await fetchProxyStatus()
      return true
    } catch (error) {
      console.error('保存代理设置失败:', error)
      proxyError.value = error instanceof Error ? error.message : '保存代理设置失败'
      return false
    }
  }

  function syncFromStore() {
    proxyMode.value = settingsStore.settings.outbound_proxy_mode
    proxyUrl.value = settingsStore.settings.outbound_proxy_url
    proxyError.value = ''
  }

  return {
    proxyMode,
    proxyUrl,
    proxyStatus,
    proxyStatusLoading,
    proxyError,
    fetchProxyStatus,
    commitProxySettings,
    syncFromStore
  }
}
