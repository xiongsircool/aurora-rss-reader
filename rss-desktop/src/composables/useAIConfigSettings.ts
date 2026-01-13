import { ref, type Ref } from 'vue'
import { useAIStore, type AIServiceKey } from '../stores/aiStore'
import type { LocalConfig } from './useSettingsModal'

export interface TestResult {
    success: boolean
    message: string
}

export function useAIConfigSettings(localConfig: Ref<LocalConfig>) {
    const aiStore = useAIStore()

    const serviceTesting = ref<Record<AIServiceKey, boolean>>({
        summary: false,
        translation: false
    })

    const serviceTestResult = ref<Record<AIServiceKey, TestResult | null>>({
        summary: null,
        translation: null
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
    }

    return {
        serviceTesting,
        serviceTestResult,
        testConnection,
        copySummaryToTranslation,
        resetTestResults
    }
}
