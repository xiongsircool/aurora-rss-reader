import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRepositories } from '../data/repositories'

/**
 * On-device settings. The standalone mobile app has no backend, so there is no
 * API base URL to configure. AI settings (endpoint / key / model / prompt) are
 * stored locally and consumed by the AI client in M3.
 */
export interface AiSettings {
  base_url: string
  api_key: string
  model: string
  prompt: string
  language: string
}

const DEFAULT_AI: AiSettings = {
  base_url: 'https://open.bigmodel.cn/api/paas/v4/',
  api_key: '',
  model: 'glm-4-flash',
  prompt: '',
  language: 'zh-CN',
}

const AI_KEY = 'ai'

export const useSettingsStore = defineStore('settings', () => {
  const ai = ref<AiSettings>({ ...DEFAULT_AI })
  const loaded = ref(false)

  async function load() {
    const repos = await getRepositories()
    ai.value = await repos.settings.getJson<AiSettings>(AI_KEY, { ...DEFAULT_AI })
    loaded.value = true
  }

  async function saveAi(patch: Partial<AiSettings>) {
    ai.value = { ...ai.value, ...patch }
    const repos = await getRepositories()
    await repos.settings.setJson(AI_KEY, ai.value)
  }

  return { ai, loaded, load, saveAi }
})
