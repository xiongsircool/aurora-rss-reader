import { ref } from 'vue'
import api from '../api/client'

export interface RSSHubTestResult {
    success: boolean
    message: string
}

export interface RSSHubMirror {
    name: string
    base_url: string
    priority: number
    is_default?: boolean
    is_current?: boolean
    description: string
}

export function useRSSHubSettings() {
    const rsshubUrl = ref('https://rsshub.app')
    const isTestingRSSHub = ref(false)
    const rsshubTestResult = ref<RSSHubTestResult | null>(null)
    const rsshubMirrors = ref<RSSHubMirror[]>([])
    const rsshubMirrorsLoading = ref(false)

    async function fetchRSSHubUrl() {
        try {
            const { data } = await api.get('/settings/rsshub-url')
            rsshubUrl.value = data.rsshub_url
        } catch (error) {
            console.error('获取RSSHub URL失败:', error)
        }
    }

    async function fetchRSSHubMirrors() {
        rsshubMirrorsLoading.value = true
        try {
            const { data } = await api.get<{ current: string; items: RSSHubMirror[] }>('/settings/rsshub-mirrors')
            rsshubMirrors.value = (data.items || []).slice().sort((a, b) => a.priority - b.priority)
        } catch (error) {
            console.error('获取RSSHub镜像列表失败:', error)
            rsshubMirrors.value = []
        } finally {
            rsshubMirrorsLoading.value = false
        }
    }

    async function saveRSSHubUrl(): Promise<boolean> {
        if (!rsshubUrl.value) {
            rsshubTestResult.value = { success: false, message: 'RSSHub URL不能为空' }
            return false
        }

        try {
            await api.post('/settings/rsshub-url', {
                rsshub_url: rsshubUrl.value
            })
            rsshubTestResult.value = {
                success: true,
                message: 'RSSHub URL保存成功！'
            }
            return true
        } catch (error) {
            rsshubTestResult.value = {
                success: false,
                message: `保存失败: ${error instanceof Error ? error.message : '网络错误'}`
            }
            return false
        }
    }

    async function testRSSHubConnection() {
        if (!rsshubUrl.value) {
            rsshubTestResult.value = { success: false, message: '请先输入RSSHub URL' }
            return
        }

        isTestingRSSHub.value = true
        rsshubTestResult.value = null

        try {
            await saveRSSHubUrl()
            const { data: result } = await api.post('/settings/test-rsshub-quick', {
                url: rsshubUrl.value
            })

            if (result.success) {
                rsshubTestResult.value = {
                    success: true,
                    message: `✅ ${result.message || 'RSSHub连接测试成功！'}`
                }
            } else {
                rsshubTestResult.value = {
                    success: false,
                    message: `❌ ${result.message || 'RSSHub连接测试失败'}`
                }
            }
        } catch (error) {
            rsshubTestResult.value = {
                success: false,
                message: `❌ RSSHub测试失败<br>
                 错误: ${error instanceof Error ? error.message : '未知错误'}<br><br>
                 请确保：<br>
                 • 后端服务正在运行<br>
                 • RSSHub URL配置正确<br>
                 • 网络连接正常`
            }
        } finally {
            isTestingRSSHub.value = false
        }
    }

    function resetTestResult() {
        rsshubTestResult.value = null
    }

    function selectMirror(url: string) {
        rsshubUrl.value = url
        resetTestResult()
    }

    return {
        rsshubUrl,
        isTestingRSSHub,
        rsshubTestResult,
        rsshubMirrors,
        rsshubMirrorsLoading,
        fetchRSSHubUrl,
        fetchRSSHubMirrors,
        saveRSSHubUrl,
        testRSSHubConnection,
        resetTestResult,
        selectMirror,
    }
}
