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

    // Global config test state
    const globalTesting = ref(false)
    const globalTestResult = ref<TestResult | null>(null)

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

    async function testGlobalConnection() {
        const globalCfg = localConfig.value.global
        if (!globalCfg.api_key || !globalCfg.base_url || !globalCfg.model_name) {
            globalTestResult.value = { success: false, message: '请先完善 API 配置' }
            return
        }

        globalTesting.value = true
        globalTestResult.value = null

        try {
            const success = await aiStore.testGlobalConnection({
                api_key: globalCfg.api_key,
                base_url: globalCfg.base_url,
                model_name: globalCfg.model_name,
            })
            globalTestResult.value = {
                success,
                message: success ? '连接测试成功！' : aiStore.error || '连接测试失败'
            }
        } catch (error) {
            globalTestResult.value = { success: false, message: '连接测试失败' }
        } finally {
            globalTesting.value = false
        }
    }

    // Embedding always uses its own config (not a chat/LLM model)
    const alwaysCustomServices: AIServiceKey[] = ['embedding']

    async function testConnection(service: AIServiceKey) {
        const serviceConfig = localConfig.value[service]
        const isAlwaysCustom = alwaysCustomServices.includes(service)

        // Determine which config to test: custom or global
        let testApiKey: string
        let testBaseUrl: string
        let testModelName: string

        if (isAlwaysCustom || serviceConfig.use_custom) {
            testApiKey = serviceConfig.api_key
            testBaseUrl = serviceConfig.base_url
            testModelName = serviceConfig.model_name
        } else {
            testApiKey = localConfig.value.global.api_key
            testBaseUrl = localConfig.value.global.base_url
            testModelName = localConfig.value.global.model_name
        }

        if (!testApiKey || !testBaseUrl || !testModelName) {
            serviceTestResult.value[service] = {
                success: false,
                message: (isAlwaysCustom || serviceConfig.use_custom) ? '请先完善服务专属 API 配置' : '请先完善全局默认 API 配置'
            }
            return
        }

        serviceTesting.value[service] = true
        serviceTestResult.value[service] = null

        try {
            const success = await aiStore.testConnection(service, {
                api_key: testApiKey,
                base_url: testBaseUrl,
                model_name: testModelName,
            })
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

    function resetTestResults() {
        globalTestResult.value = null
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
        globalTesting,
        globalTestResult,
        testGlobalConnection,
        serviceTesting,
        serviceTestResult,
        testConnection,
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
