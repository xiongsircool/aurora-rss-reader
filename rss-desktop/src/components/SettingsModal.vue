<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import type { LocaleCode } from '../i18n'
import { useAIStore, type AIServiceKey } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { setLanguage, currentLanguage, availableLocales } = useLanguage()
const aiStore = useAIStore()
const settingsStore = useSettingsStore()

type TestResult = { success: boolean; message: string }
type ServiceKey = AIServiceKey

const createLocalServiceConfig = () => ({
  api_key: '',
  base_url: 'https://open.bigmodel.cn/api/paas/v4/',
  model_name: 'glm-4-flash'
})

const localConfig = ref({
  summary: createLocalServiceConfig(),
  translation: createLocalServiceConfig(),
  features: {
    auto_summary: false,
    auto_translation: false,
    auto_title_translation: false,
    translation_language: 'zh'
  }
})

// RSSHub URL配置
const rsshubUrl = ref('https://rsshub.app')
const isTestingRSSHub = ref(false)
const rsshubTestResult = ref<{ success: boolean; message: string } | null>(null)
const serviceTesting = ref<Record<ServiceKey, boolean>>({
  summary: false,
  translation: false
})
const serviceTestResult = ref<Record<ServiceKey, TestResult | null>>({
  summary: null,
  translation: null
})

// 语言选择器的本地绑定 - 使用computed确保响应式
const selectedLanguage = computed({
  get: () => currentLanguage.value?.code || 'zh',
  set: (value: string) => handleLanguageChange(value)
})

// 显示设置 - 与settingsStore同步
const enableDateFilter = computed({
  get: () => settingsStore.settings.enable_date_filter,
  set: (value) => {
    settingsStore.updateSettings({ enable_date_filter: value })
  }
})

const defaultDateRange = computed({
  get: () => settingsStore.settings.default_date_range,
  set: (value) => {
    settingsStore.updateSettings({ default_date_range: value })
  }
})

const timeField = computed({
  get: () => settingsStore.settings.time_field,
  set: (value) => {
    settingsStore.updateSettings({ time_field: value })
  }
})

// 订阅刷新设置 - 与settingsStore同步
const autoRefresh = computed({
  get: () => settingsStore.settings.fetch_interval_minutes < 1440, // 1440表示禁用自动刷新
  set: (_value) => {
    // 这里我们可以通过setInterval来控制，但为了简单起见，我们假设总是启用
    // 实际的实现可能需要更复杂的逻辑
  }
})

const fetchInterval = computed({
  get: () => settingsStore.settings.fetch_interval_minutes,
  set: (value) => {
    if (value >= 5 && value <= 1440) {
      settingsStore.updateSettings({ fetch_interval_minutes: value })
    }
  }
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
    auto_translation: features.auto_translation ?? localConfig.value.features.auto_translation,
    auto_title_translation: features.auto_title_translation ?? localConfig.value.features.auto_title_translation,
    translation_language: features.translation_language ?? localConfig.value.features.translation_language
  }
}

// 监听store配置变化
watch(() => aiStore.config, () => {
  syncFromStore()
}, { deep: true })

// 监听模态框显示状态
watch(() => props.show, async (show) => {
  if (show) {
    await Promise.all([
      aiStore.fetchConfig(),
      settingsStore.fetchSettings(),
      fetchRSSHubUrl()
    ])
    syncFromStore()
    serviceTestResult.value.summary = null
    serviceTestResult.value.translation = null
    rsshubTestResult.value = null
  }
})

async function testConnection(service: ServiceKey) {
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

async function fetchRSSHubUrl() {
  try {
    const response = await fetch('/api/settings/rsshub-url')
    if (response.ok) {
      const data = await response.json()
      rsshubUrl.value = data.rsshub_url
    }
  } catch (error) {
    console.error('获取RSSHub URL失败:', error)
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
    // 先保存RSSHub URL
    await saveRSSHubUrl()

    // 通过后端API测试RSSHub连通性
    const response = await fetch('/api/settings/test-rsshub-quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()

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

async function saveRSSHubUrl() {
  if (!rsshubUrl.value) {
    rsshubTestResult.value = { success: false, message: 'RSSHub URL不能为空' }
    return
  }

  try {
    const response = await fetch('/api/settings/rsshub-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rsshub_url: rsshubUrl.value
      })
    })

    if (response.ok) {
      rsshubTestResult.value = {
        success: true,
        message: 'RSSHub URL保存成功！'
      }
    } else {
      const errorData = await response.json()
      rsshubTestResult.value = {
        success: false,
        message: `保存失败: ${errorData.detail || '未知错误'}`
      }
    }
  } catch (error) {
    rsshubTestResult.value = {
      success: false,
      message: `保存失败: ${error instanceof Error ? error.message : '网络错误'}`
    }
  }
}

async function saveSettings() {
  try {
    // 先保存RSSHub URL
    if (rsshubUrl.value) {
      await saveRSSHubUrl()
    }

    // 保存AI配置
    const aiSuccess = await aiStore.updateConfig({
      summary: { ...localConfig.value.summary },
      translation: { ...localConfig.value.translation },
      features: { ...localConfig.value.features }
    })
    if (!aiSuccess) {
      console.error('AI配置保存失败')
    }

    // 设置已经通过computed属性自动保存了，不需要额外操作
    // 因为enableDateFilter、defaultDateRange、timeField、fetchInterval都使用了computed的setter

    emit('close')
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

function handleClose() {
  emit('close')
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}

// 优化语言切换体验
function handleLanguageChange(newLanguage: string) {
  // 验证语言代码有效性
  if (!newLanguage || !availableLocales.some(locale => locale.code === newLanguage)) {
    console.warn(`无效的语言代码: ${newLanguage}`)
    return
  }

  // 检查是否已经是当前语言
  if (currentLanguage.value?.code === newLanguage) {
    return
  }

  // 切换语言 (setLanguage会自动保存到localStorage)
  setLanguage(newLanguage as LocaleCode)

  // 显示成功提示
  console.log(`语言已切换到: ${newLanguage}`)
}

</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ t('settings.title') }}</h2>
          <button @click="handleClose" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <!-- Language Settings -->
          <section class="settings-section">
            <h3>{{ t('settings.language') }}</h3>
            <div class="form-group">
              <select
                v-model="selectedLanguage"
                class="form-select"
              >
                <option
                  v-for="locale in availableLocales"
                  :key="locale.code"
                  :value="locale.code"
                >
                  {{ locale.flag }} {{ locale.name }}
                </option>
              </select>
            </div>
          </section>

          <section class="settings-section">
            <h3>{{ t('settings.rssHubConfig') }}</h3>
            <div class="form-group">
              <label>RSSHub URL</label>
              <input
                v-model="rsshubUrl"
                type="text"
                :placeholder="t('settings.rssHubPlaceholder')"
                class="form-input"
              />
              <p class="form-hint">
                {{ t('settings.rssHubDescription') }}
              </p>
              <p class="form-hint">
                {{ t('settings.rssHubDeployGuide') }}: <a href="https://docs.rsshub.app/zh/deploy/" target="_blank">RSSHub部署指南</a>
              </p>
            </div>

            <div class="form-group">
              <button
                @click="testRSSHubConnection"
                :disabled="isTestingRSSHub || !rsshubUrl"
                class="test-btn"
                :class="{
                  loading: isTestingRSSHub,
                  success: rsshubTestResult?.success,
                  error: rsshubTestResult?.success === false
                }"
              >
                {{ isTestingRSSHub ? t('settings.testingRssHub') : t('settings.testRssHub') }}
              </button>
              <div v-if="rsshubTestResult" class="test-result" :class="{
                success: rsshubTestResult.success,
                error: !rsshubTestResult.success
              }">
                {{ rsshubTestResult.message }}
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3>{{ t('settings.aiConfig') }}</h3>
            <div class="ai-config-grid">
              <div class="ai-config-card">
                <div class="ai-config-card__header">
                  <div>
                    <p class="ai-config-card__title">{{ t('settings.summaryGeneration') }}</p>
                    <p class="ai-config-card__subtitle">{{ t('settings.summarySubtitle') }}</p>
                  </div>
                  <button
                    @click="testConnection('summary')"
                    :disabled="serviceTesting.summary || !localConfig.summary.api_key || !localConfig.summary.base_url || !localConfig.summary.model_name"
                    class="test-btn"
                    :class="{
                      loading: serviceTesting.summary,
                      success: serviceTestResult.summary?.success,
                      error: serviceTestResult.summary?.success === false
                    }"
                  >
                    {{ serviceTesting.summary ? t('common.testing') : t('settings.testConnection') }}
                  </button>
                </div>

                <div class="form-group">
                  <label>{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="localConfig.summary.api_key"
                    type="password"
                    :placeholder="t('settings.apiKeyPlaceholder')"
                    class="form-input"
                  />
                  <p class="form-hint">
                    {{ t('settings.getApiKey') }}
                    <a href="https://open.bigmodel.cn" target="_blank">https://open.bigmodel.cn</a>
                  </p>
                </div>

                <div class="form-group">
                  <label>{{ t('settings.apiUrl') }}</label>
                  <input
                    v-model="localConfig.summary.base_url"
                    type="text"
                    :placeholder="t('settings.apiUrlPlaceholder')"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label>{{ t('settings.modelName') }}</label>
                  <input
                    v-model="localConfig.summary.model_name"
                    type="text"
                    :placeholder="t('settings.modelPlaceholder')"
                    class="form-input"
                  />
                  <p class="form-hint">
                    {{ t('settings.supportedModels') }}
                  </p>
                </div>

                <div
                  v-if="serviceTestResult.summary"
                  class="test-result"
                  :class="{ success: serviceTestResult.summary.success, error: !serviceTestResult.summary.success }"
                >
                  {{ serviceTestResult.summary.message }}
                </div>
              </div>

              <div class="ai-config-card">
                <div class="ai-config-card__header">
                  <div>
                    <p class="ai-config-card__title">{{ t('settings.contentTranslation') }}</p>
                    <p class="ai-config-card__subtitle">{{ t('settings.translationSubtitle') }}</p>
                  </div>
                  <div class="ai-config-card__actions">
                    <button class="ghost-btn" type="button" @click="copySummaryToTranslation">
                      {{ t('settings.useSummaryConfig') }}
                    </button>
                    <button
                      @click="testConnection('translation')"
                      :disabled="serviceTesting.translation || !localConfig.translation.api_key || !localConfig.translation.base_url || !localConfig.translation.model_name"
                      class="test-btn"
                      :class="{
                        loading: serviceTesting.translation,
                        success: serviceTestResult.translation?.success,
                        error: serviceTestResult.translation?.success === false
                      }"
                    >
                      {{ serviceTesting.translation ? t('common.testing') : t('settings.testConnection') }}
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="localConfig.translation.api_key"
                    type="password"
                    :placeholder="t('settings.translationApiKeyPlaceholder')"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label>{{ t('settings.apiUrl') }}</label>
                  <input
                    v-model="localConfig.translation.base_url"
                    type="text"
                    :placeholder="t('settings.apiUrlPlaceholder')"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label>{{ t('settings.modelName') }}</label>
                  <input
                    v-model="localConfig.translation.model_name"
                    type="text"
                    :placeholder="t('settings.translationModelPlaceholder')"
                    class="form-input"
                  />
                </div>

                <div
                  v-if="serviceTestResult.translation"
                  class="test-result"
                  :class="{ success: serviceTestResult.translation.success, error: !serviceTestResult.translation.success }"
                >
                  {{ serviceTestResult.translation.message }}
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3>{{ t('settings.aiFeatures') }}</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.features.auto_summary"
                  type="checkbox"
                  class="form-checkbox"
                />
                {{ t('settings.autoSummary') }}
                <span class="checkbox-hint">{{ t('settings.autoSummaryHint') }}</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.features.auto_translation"
                  type="checkbox"
                  class="form-checkbox"
                />
                {{ t('settings.autoTranslation') }}
                <span class="checkbox-hint">{{ t('settings.autoTranslationHint') }}</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.features.auto_title_translation"
                  type="checkbox"
                  class="form-checkbox"
                />
                {{ t('settings.autoTitleTranslation') }}
                <span class="checkbox-hint">{{ t('settings.autoTitleTranslationHint') }}</span>
              </label>
            </div>

            <div
              class="form-group"
              v-if="localConfig.features.auto_translation || localConfig.features.auto_title_translation"
            >
              <label>{{ t('settings.translationTargetLanguage') }}</label>
              <select v-model="localConfig.features.translation_language" class="form-select">
                <option value="zh">{{ t('languages.zh') }}</option>
                <option value="en">{{ t('languages.en') }}</option>
                <option value="ja">{{ t('languages.ja') }}</option>
                <option value="ko">{{ t('languages.ko') }}</option>
                <option value="fr">{{ t('languages.fr') }}</option>
                <option value="de">{{ t('languages.de') }}</option>
                <option value="es">{{ t('languages.es') }}</option>
              </select>
            </div>
          </section>

          <section class="settings-section">
            <h3>{{ t('settings.subscriptionUpdate') }}</h3>
            <div class="form-group">
              <label>
                <input
                  v-model="autoRefresh"
                  type="checkbox"
                  class="form-checkbox"
                />
                {{ t('settings.autoRefresh') }}
              </label>
            </div>

            <div class="form-group">
              <label>{{ t('settings.refreshInterval') }}</label>
              <input
                v-model.number="fetchInterval"
                type="number"
                min="5"
                max="1440"
                class="form-input"
              />
              <p class="form-hint">
                {{ t('settings.refreshIntervalDescription') }}
              </p>
            </div>
          </section>

          <section class="settings-section">
            <h3>{{ t('settings.displaySettings') }}</h3>
            <div class="form-group">
              <label>
                <input
                  v-model="enableDateFilter"
                  type="checkbox"
                  class="form-checkbox"
                />
                {{ t('settings.enableTimeFilter') }}
              </label>
              <p class="form-hint">{{ t('settings.timeFilterDescription') }}</p>
            </div>

            <div class="form-group" v-if="enableDateFilter">
              <label>{{ t('settings.defaultTimeRange') }}</label>
              <select v-model="defaultDateRange" class="form-select">
                <option value="1d">{{ t('time.last1Day') }}</option>
                <option value="7d">{{ t('time.last1Week') }}</option>
                <option value="30d">{{ t('time.last1Month') }}</option>
                <option value="90d">{{ t('time.last3Months') }}</option>
                <option value="180d">{{ t('time.last6Months') }}</option>
                <option value="365d">{{ t('time.last1Year') }}</option>
                <option value="all">{{ t('time.allTime') }}</option>
              </select>
              <p class="form-hint">{{ t('settings.timeRangeDescription') }}</p>
            </div>

            <div class="form-group" v-if="enableDateFilter">
              <label>{{ t('settings.timeBase') }}</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    v-model="timeField"
                    type="radio"
                    value="inserted_at"
                    class="form-radio"
                  />
                  {{ t('settings.entryTime') }}
                </label>
                <label class="radio-label">
                  <input
                    v-model="timeField"
                    type="radio"
                    value="published_at"
                    class="form-radio"
                  />
                  {{ t('settings.publishTime') }}
                </label>
              </div>
              <p class="form-hint">
                {{ t('settings.timeBaseDescription') }}
              </p>
            </div>
          </section>

          <section class="settings-section">
            <h3>{{ t('settings.about') }}</h3>
            <div class="about-content">
              <div class="about-header">
                <h4 class="app-title">{{ t('settings.appName', { name: 'Aurora Feeds' }) }}</h4>
                <span class="app-version">{{ t('settings.appVersion', { version: '0.1.0' }) }}</span>
              </div>
              <p class="app-name-note">
                {{ t('settings.appNameDescription', { name: 'Aurora Feeds' }) }}
              </p>
              <p class="app-description">
                {{ t('settings.aboutDescription') }}
              </p>
              <div class="about-features">
                <span class="feature-badge">📰 {{ t('settings.features.rss') }}</span>
                <span class="feature-badge">🤖 {{ t('settings.features.ai') }}</span>
                <span class="feature-badge">🌐 {{ t('settings.features.translation') }}</span>
                <span class="feature-badge">⭐ {{ t('settings.features.favorites') }}</span>
              </div>
              <div class="about-links">
                <a href="https://github.com/yourusername/RSSpage" target="_blank" class="about-link">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  {{ t('settings.projectHomepage') }}
                </a>
                <a href="https://github.com/yourusername/RSSpage/issues" target="_blank" class="about-link">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zM8 4a.905.905 0 00-.9.995l.35 3.507a.552.552 0 001.1 0l.35-3.507A.905.905 0 008 4z"/>
                  </svg>
                  {{ t('settings.feedbackIssue') }}
                </a>
              </div>
              <p class="about-footer">
                Made with ❤️ using Vue 3 + FastAPI
              </p>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button @click="handleClose" class="btn btn-secondary">{{ t('settings.cancel') }}</button>
          <button @click="saveSettings" class="btn btn-primary">{{ t('settings.save') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  --settings-accent: #4c74ff;
  --settings-accent-strong: #2f54ff;
  --settings-muted: #5a6276;
  background: linear-gradient(180deg, #ffffff 0%, #f5f7fc 100%);
  color: var(--text-primary, #0f1419);
  border-radius: 18px;
  width: 92%;
  max-width: 640px;
  max-height: 82vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(15, 20, 25, 0.08);
  box-shadow:
    0 20px 60px rgba(15, 20, 25, 0.25),
    0 2px 8px rgba(15, 20, 25, 0.08);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.close-btn {
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: rgba(255, 255, 255, 0.7);
}

.settings-section {
  margin-bottom: 24px;
  padding: 18px 20px;
  border-radius: 14px;
  background: #f8faff;
  border: 1px solid rgba(76, 116, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 600;
}

.ai-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.ai-config-card {
  border: 1px solid var(--border-color, rgba(15, 17, 21, 0.12));
  border-radius: 12px;
  padding: 16px;
  background: var(--bg-surface, #ffffff);
}

.ai-config-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ai-config-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-config-card__subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.ai-config-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ghost-btn {
  border: 1px dashed rgba(76, 116, 255, 0.4);
  background: rgba(76, 116, 255, 0.08);
  color: var(--settings-accent, #4c74ff);
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.ghost-btn:hover {
  background: rgba(76, 116, 255, 0.15);
  border-color: var(--settings-accent-strong, #2f54ff);
  color: var(--settings-accent-strong, #2f54ff);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.form-input,
.form-select {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid rgba(92, 106, 138, 0.22);
  border-radius: 10px;
  font-size: 14px;
  background: #fefefe;
  color: var(--text-primary, #0f1419);
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: inset 0 1px 2px rgba(15, 20, 25, 0.04);
}

.form-input::placeholder {
  color: rgba(90, 98, 118, 0.62);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--settings-accent, #4c74ff);
  box-shadow: 0 0 0 3px rgba(76, 116, 255, 0.15);
}

.form-checkbox {
  margin-right: 8px;
}

.form-radio {
  margin-right: 8px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  font-weight: normal;
  margin-bottom: 0;
}

.form-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.form-hint a {
  color: var(--accent);
  text-decoration: none;
}

.form-hint a:hover {
  text-decoration: underline;
}


.test-btn {
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
  background: linear-gradient(130deg, var(--settings-accent, #4c74ff), var(--settings-accent-strong, #2f54ff));
  color: #fff;
  box-shadow: 0 10px 20px rgba(76, 116, 255, 0.25);
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  opacity: 0.95;
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.test-btn.loading {
  opacity: 0.7;
  transform: none;
}

.test-btn.success {
  background: #34c759;
  box-shadow: none;
}

.test-btn.error {
  background: #ff4d4f;
  box-shadow: none;
}

.test-result {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid transparent;
  background: #fff;
  box-shadow: 0 10px 20px rgba(15, 20, 25, 0.08);
}

.test-result.success {
  color: #0f7a39;
  border-color: rgba(52, 199, 89, 0.35);
}

.test-result.error {
  color: #c43838;
  border-color: rgba(255, 77, 79, 0.35);
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  padding: 4px 0;
}

.checkbox-hint {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-top: 2px;
  line-height: 1.3;
}

.about-content {
  background: linear-gradient(135deg, rgba(255, 122, 24, 0.05) 0%, rgba(88, 86, 214, 0.05) 100%);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--border-color);
}

.about-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.app-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(120deg, #ff7a18, #5856d6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-version {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid rgba(0, 122, 255, 0.2);
}

.app-description {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.app-name-note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--settings-muted);
}

.about-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.feature-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  transition: all 0.2s;
}

.feature-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.about-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #ffffff;
  border: 1px solid rgba(92, 106, 138, 0.16);
  border-radius: 10px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.about-link:hover {
  border-color: var(--settings-accent, #4c74ff);
  background: rgba(76, 116, 255, 0.08);
  transform: translateX(4px);
}

.about-link svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.about-footer {
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  font-style: italic;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f2f4fb;
  color: var(--settings-muted, #5a6276);
  border: 1px solid rgba(92, 106, 138, 0.2);
}

.btn-secondary:hover {
  background: #e4e8f4;
}

.btn-primary {
  background: linear-gradient(130deg, var(--settings-accent, #4c74ff), var(--settings-accent-strong, #2f54ff));
  color: white;
  box-shadow: 0 12px 24px rgba(76, 116, 255, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(76, 116, 255, 0.3);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
}

/* =====================
   Dark mode overrides
   ===================== */
:global(.dark) .modal-backdrop {
  background: rgba(0, 0, 0, 0.6);
}

:global(.dark) .modal-content {
  background: linear-gradient(180deg, #181b22 0%, #0f1115 100%);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 2px 8px rgba(0, 0, 0, 0.4);
}

:global(.dark) .modal-header {
  border-color: var(--border-color);
}

:global(.dark) .close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

:global(.dark) .modal-body {
  background: rgba(24, 27, 34, 0.7);
}

:global(.dark) .settings-section {
  background: rgba(255, 255, 255, 0.035);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

:global(.dark) .ghost-btn {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}
:global(.dark) .ghost-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent);
  color: var(--accent);
}

:global(.dark) .form-input,
:global(.dark) .form-select {
  background: var(--bg-surface);
  color: var(--text-primary);
  border-color: var(--border-color);
  box-shadow: none;
}
:global(.dark) .form-input::placeholder {
  color: var(--text-secondary);
}

:global(.dark) .radio-label,
:global(.dark) .checkbox-label {
  color: var(--text-primary);
}

:global(.dark) .test-result {
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
}

:global(.dark) .about-content {
  border-color: var(--border-color);
}

:global(.dark) .app-version {
  background: rgba(0, 122, 255, 0.15);
  color: #71b3ff;
  border-color: rgba(0, 122, 255, 0.35);
}

:global(.dark) .feature-badge {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-secondary);
}

:global(.dark) .about-link {
  background: var(--bg-surface);
  border-color: var(--border-color);
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
:global(.dark) .about-link:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent);
}

:global(.dark) .about-footer {
  border-color: var(--border-color);
  color: var(--text-secondary);
}

:global(.dark) .modal-footer {
  border-color: var(--border-color);
}

:global(.dark) .btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
:global(.dark) .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Modal body scrollbar styling */
.modal-body::-webkit-scrollbar { width: 8px; height: 8px; }
.modal-body::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.modal-body:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }
:global(.dark) .modal-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .modal-body:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }
.modal-body { scrollbar-width: thin; scrollbar-color: rgba(15, 17, 21, 0.28) transparent; }
:global(.dark) .modal-body { scrollbar-color: rgba(255, 255, 255, 0.36) transparent; }
</style>
