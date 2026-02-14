import { ref, watch } from 'vue'
import { useAIStore } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'

export interface LocalGlobalConfig {
    provider: string
    api_key: string
    base_url: string
    model_name: string
}

export interface LocalServiceConfig {
    use_custom: boolean
    api_key: string
    base_url: string
    model_name: string
}

export interface LocalFeatureConfig {
    auto_summary: boolean
    auto_title_translation: boolean
    auto_tagging: boolean
    title_display_mode: 'replace' | 'translation-first' | 'original-first'
    translation_language: string
}

export interface LocalConfig {
    global: LocalGlobalConfig
    summary: LocalServiceConfig
    translation: LocalServiceConfig
    tagging: LocalServiceConfig
    embedding: LocalServiceConfig
    features: LocalFeatureConfig
}

const createLocalGlobalConfig = (): LocalGlobalConfig => ({
    provider: '',
    api_key: '',
    base_url: '',
    model_name: ''
})

const createLocalServiceConfig = (): LocalServiceConfig => ({
    use_custom: false,
    api_key: '',
    base_url: '',
    model_name: ''
})

const createLocalFeatureConfig = (): LocalFeatureConfig => ({
    auto_summary: false,
    auto_title_translation: false,
    auto_tagging: false,
    title_display_mode: 'original-first',
    translation_language: 'zh'
})

export function useSettingsModal() {
    const aiStore = useAIStore()
    const settingsStore = useSettingsStore()

    const localConfig = ref<LocalConfig>({
        global: createLocalGlobalConfig(),
        summary: createLocalServiceConfig(),
        translation: createLocalServiceConfig(),
        tagging: createLocalServiceConfig(),
        embedding: createLocalServiceConfig(),
        features: createLocalFeatureConfig()
    })

    function syncFromStore() {
        const global = aiStore.config.global || {}
        const summary = aiStore.config.summary || {}
        const translation = aiStore.config.translation || {}
        const tagging = aiStore.config.tagging || {}
        const embedding = aiStore.config.embedding || {}
        const features = aiStore.config.features || {}

        localConfig.value.global = {
            provider: (global as any).provider ?? localConfig.value.global.provider,
            api_key: (global as any).api_key ?? localConfig.value.global.api_key,
            base_url: (global as any).base_url ?? localConfig.value.global.base_url,
            model_name: (global as any).model_name ?? localConfig.value.global.model_name,
        }
        localConfig.value.summary = {
            use_custom: (summary as any).use_custom ?? localConfig.value.summary.use_custom,
            api_key: summary.api_key ?? localConfig.value.summary.api_key,
            base_url: summary.base_url ?? localConfig.value.summary.base_url,
            model_name: summary.model_name ?? localConfig.value.summary.model_name,
        }
        localConfig.value.translation = {
            use_custom: (translation as any).use_custom ?? localConfig.value.translation.use_custom,
            api_key: translation.api_key ?? localConfig.value.translation.api_key,
            base_url: translation.base_url ?? localConfig.value.translation.base_url,
            model_name: translation.model_name ?? localConfig.value.translation.model_name,
        }
        localConfig.value.tagging = {
            use_custom: (tagging as any).use_custom ?? localConfig.value.tagging.use_custom,
            api_key: tagging.api_key ?? localConfig.value.tagging.api_key,
            base_url: tagging.base_url ?? localConfig.value.tagging.base_url,
            model_name: tagging.model_name ?? localConfig.value.tagging.model_name,
        }
        localConfig.value.embedding = {
            use_custom: (embedding as any).use_custom ?? localConfig.value.embedding.use_custom,
            api_key: embedding.api_key ?? localConfig.value.embedding.api_key,
            base_url: embedding.base_url ?? localConfig.value.embedding.base_url,
            model_name: embedding.model_name ?? localConfig.value.embedding.model_name,
        }
        localConfig.value.features = {
            ...localConfig.value.features,
            auto_summary: features.auto_summary ?? localConfig.value.features.auto_summary,
            auto_title_translation: features.auto_title_translation ?? localConfig.value.features.auto_title_translation,
            auto_tagging: features.auto_tagging ?? localConfig.value.features.auto_tagging,
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
            global: { ...localConfig.value.global },
            summary: { ...localConfig.value.summary },
            translation: { ...localConfig.value.translation },
            tagging: { ...localConfig.value.tagging },
            embedding: { ...localConfig.value.embedding },
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
