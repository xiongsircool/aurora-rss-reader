import { ref, watch } from 'vue'
import { useAIStore } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'

export interface LocalServiceConfig {
    api_key: string
    base_url: string
    model_name: string
}

export interface LocalFeatureConfig {
    auto_summary: boolean
    auto_title_translation: boolean
    title_display_mode: 'replace' | 'translation-first' | 'original-first'
    translation_language: string
}

export interface LocalConfig {
    summary: LocalServiceConfig
    translation: LocalServiceConfig
    features: LocalFeatureConfig
}

const createLocalServiceConfig = (): LocalServiceConfig => ({
    api_key: '',
    base_url: 'https://open.bigmodel.cn/api/paas/v4/',
    model_name: 'glm-4-flash'
})

const createLocalFeatureConfig = (): LocalFeatureConfig => ({
    auto_summary: false,
    auto_title_translation: false,
    title_display_mode: 'original-first',
    translation_language: 'zh'
})

export function useSettingsModal() {
    const aiStore = useAIStore()
    const settingsStore = useSettingsStore()

    const localConfig = ref<LocalConfig>({
        summary: createLocalServiceConfig(),
        translation: createLocalServiceConfig(),
        features: createLocalFeatureConfig()
    })

    function syncFromStore() {
        const summary = aiStore.config.summary || {}
        const translation = aiStore.config.translation || {}
        const features = aiStore.config.features || {}

        localConfig.value.summary = {
            ...localConfig.value.summary,
            api_key: summary.api_key ?? localConfig.value.summary.api_key,
            base_url: summary.base_url ?? localConfig.value.summary.base_url,
            model_name: summary.model_name ?? localConfig.value.summary.model_name
        }
        localConfig.value.translation = {
            ...localConfig.value.translation,
            api_key: translation.api_key ?? localConfig.value.translation.api_key,
            base_url: translation.base_url ?? localConfig.value.translation.base_url,
            model_name: translation.model_name ?? localConfig.value.translation.model_name
        }
        localConfig.value.features = {
            ...localConfig.value.features,
            auto_summary: features.auto_summary ?? localConfig.value.features.auto_summary,
            auto_title_translation: features.auto_title_translation ?? localConfig.value.features.auto_title_translation,
            title_display_mode: features.title_display_mode ?? localConfig.value.features.title_display_mode,
            translation_language: features.translation_language ?? localConfig.value.features.translation_language
        }
    }

    // Watch store config changes
    watch(() => aiStore.config, () => {
        syncFromStore()
    }, { deep: true })

    async function initializeSettings(
        onRSSHubFetch: () => Promise<void>,
        resetTestResults: () => void
    ) {
        await Promise.all([
            aiStore.fetchConfig(),
            settingsStore.fetchSettings(),
            onRSSHubFetch()
        ])
        syncFromStore()
        resetTestResults()
    }

    async function saveAIConfig() {
        const success = await aiStore.updateConfig({
            summary: { ...localConfig.value.summary },
            translation: { ...localConfig.value.translation },
            features: { ...localConfig.value.features }
        })
        if (!success) {
            console.error('AI配置保存失败')
        }
        return success
    }

    return {
        localConfig,
        syncFromStore,
        initializeSettings,
        saveAIConfig,
        aiStore,
        settingsStore
    }
}
