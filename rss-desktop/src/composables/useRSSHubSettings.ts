import { ref } from 'vue'
import api from '../api/client'

export interface RSSHubTestResult {
    success: boolean
    message: string
}

export function useRSSHubSettings() {
    const rsshubUrl = ref('https://rsshub.app')
    const isTestingRSSHub = ref(false)
    const rsshubTestResult = ref<RSSHubTestResult | null>(null)

    async function fetchRSSHubUrl() {
        try {
            const { data } = await api.get('/settings/rsshub-url')
            rsshubUrl.value = data.rsshub_url
        } catch (error) {
            console.error('获取RSSHub URL失败:', error)
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
            const { data: result } = await api.post('/settings/test-rsshub-quick')

            if (result.success) {
                rsshubTestResult.value = {
                    success: true,
                    message: `✅ RSSHub连接测试成功！<br>
                   响应时间: ${result.response_time?.toFixed(2)}秒<br>
                   RSS条目数: ${result.entries_count}<br>
                   Feed标题: ${result.feed_title}<br>
                   测试路由: ${result.test_url.split('/').pop()}`
                }
            } else {
                rsshubTestResult.value = {
                    success: false,
                    message: `❌ RSSHub连接测试失败<br>
                   错误信息: ${result.message}<br>
                   测试地址: ${result.rsshub_url}<br>
                   测试时间: ${new Date(result.tested_at).toLocaleString()}`
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

    return {
        rsshubUrl,
        isTestingRSSHub,
        rsshubTestResult,
        fetchRSSHubUrl,
        saveRSSHubUrl,
        testRSSHubConnection,
        resetTestResult
    }
}
