import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAIStore, type AIServiceKey } from '../stores/aiStore'
import type { LocalConfig } from './useSettingsModal'
import type { ConfirmOptions } from './useConfirmDialog'

export interface TestResult {
    success: boolean
    message: string
}

export function useAIConfigSettings(
    localConfig: Ref<LocalConfig>,
    requestConfirm: (options: ConfirmOptions) => Promise<boolean>
) {
    const aiStore = useAIStore()
    const { t } = useI18n()

    const serviceTesting = ref<Record<AIServiceKey, boolean>>({
        summary: false,
        translation: false,
        tagging: false,
        embedding: false
    })

    const serviceTestResult = ref<Record<AIServiceKey, TestResult | null>>({
        summary: null,
        translation: null,
        tagging: null,
        embedding: null
    })

    async function testConnection(service: AIServiceKey) {
        const serviceConfig = localConfig.value[service]
        if (!serviceConfig.api_key || !serviceConfig.base_url || !serviceConfig.model_name) {
            serviceTestResult.value[service] = { success: false, message: '请先完善API配置' }
            return
        }

        serviceTesting.value[service] = true
        serviceTestResult.value[service] = null

        try {
            const success = await aiStore.testConnection(service, serviceConfig)
            serviceTestResult.value[service] = {
                success,
                message: success ? '连接测试成功！' : aiStore.error || '连接测试失败'
            }
        } catch (error) {
            serviceTestResult.value[service] = { success: false, message: '连接测试失败' }
        } finally {
            serviceTesting.value[service] = false
        }
    }

    function copySummaryToTranslation() {
        localConfig.value.translation = { ...localConfig.value.summary }
        serviceTestResult.value.translation = null
    }

    function resetTestResults() {
        serviceTestResult.value.summary = null
        serviceTestResult.value.translation = null
        serviceTestResult.value.tagging = null
        serviceTestResult.value.embedding = null
    }

    const rebuildingVectors = ref(false)
    const rebuildResult = ref<TestResult | null>(null)

    // MCP testing state
    const mcpTesting = ref(false)
    const mcpTestResult = ref<TestResult | null>(null)

    async function rebuildVectors() {
        if (!localConfig.value.embedding.api_key) {
            rebuildResult.value = {
                success: false,
                message: '请先配置 Embedding API'
            }
            return
        }

        const confirmed = await requestConfirm({
            title: t('settings.rebuildVectors'),
            message: t('settings.rebuildVectorsConfirm'),
            confirmText: t('common.confirm'),
            cancelText: t('common.cancel'),
            danger: true
        })
        if (!confirmed) return

        rebuildingVectors.value = true
        rebuildResult.value = null

        try {
            const result = await aiStore.rebuildVectors()
            rebuildResult.value = {
                success: result.success,
                message: result.message || (result.success ? '重建成功！' : '重建失败')
            }

            // 5秒后清除结果
            setTimeout(() => {
                rebuildResult.value = null
            }, 5000)
        } catch (error) {
            rebuildResult.value = {
                success: false,
                message: '重建向量库失败'
            }
        } finally {
            rebuildingVectors.value = false
        }
    }

    async function testMcp() {
        mcpTesting.value = true
        mcpTestResult.value = null

        try {
            const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
            const response = await fetch(`${apiBase}/health`)
            const data = await response.json()
            if (data?.status === 'ok' || data?.status === 'degraded') {
                mcpTestResult.value = {
                    success: true,
                    message: 'MCP 服务连接正常'
                }
            } else {
                mcpTestResult.value = {
                    success: false,
                    message: 'MCP 服务响应异常'
                }
            }
        } catch (error) {
            mcpTestResult.value = {
                success: false,
                message: 'MCP 服务连接失败'
            }
        } finally {
            mcpTesting.value = false
        }
    }

    function resetMcpTestResult() {
        mcpTestResult.value = null
    }

    return {
        serviceTesting,
        serviceTestResult,
        testConnection,
        copySummaryToTranslation,
        resetTestResults,
        rebuildingVectors,
        rebuildResult,
        rebuildVectors,
        mcpTesting,
        mcpTestResult,
        testMcp,
        resetMcpTestResult
    }
}
