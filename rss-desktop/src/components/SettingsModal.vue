<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAIStore, type AIServiceKey } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

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

</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
      <div class="modal-content">
        <div class="modal-header">
          <h2>设置</h2>
          <button @click="handleClose" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <section class="settings-section">
            <h3>RSSHub 配置</h3>
            <div class="form-group">
              <label>RSSHub URL</label>
              <input
                v-model="rsshubUrl"
                type="text"
                placeholder="输入您的RSSHub地址，如：http://58.198.178.157:1200"
                class="form-input"
              />
              <p class="form-hint">
                输入您自己的RSSHub实例地址，用于获取各种网站的RSS订阅
              </p>
              <p class="form-hint">
                部署RSSHub: <a href="https://docs.rsshub.app/zh/guide/install/" target="_blank">RSSHub部署指南</a>
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
                {{ isTestingRSSHub ? '测试中...' : '测试RSSHub连通性' }}
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
            <h3>AI 配置</h3>
            <div class="ai-config-grid">
              <div class="ai-config-card">
                <div class="ai-config-card__header">
                  <div>
                    <p class="ai-config-card__title">摘要生成</p>
                    <p class="ai-config-card__subtitle">用于 AI 摘要与自动摘要</p>
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
                    {{ serviceTesting.summary ? '测试中...' : '测试连接' }}
                  </button>
                </div>

                <div class="form-group">
                  <label>API Key</label>
                  <input
                    v-model="localConfig.summary.api_key"
                    type="text"
                    placeholder="输入 GLM API Key"
                    class="form-input"
                  />
                  <p class="form-hint">
                    获取 API Key:
                    <a href="https://open.bigmodel.cn" target="_blank">https://open.bigmodel.cn</a>
                  </p>
                </div>

                <div class="form-group">
                  <label>API 地址</label>
                  <input
                    v-model="localConfig.summary.base_url"
                    type="text"
                    placeholder="API Base URL"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label>模型名称</label>
                  <input
                    v-model="localConfig.summary.model_name"
                    type="text"
                    placeholder="例如: glm-4-flash"
                    class="form-input"
                  />
                  <p class="form-hint">
                    支持模型: glm-4-flash, glm-4, glm-4-air, glm-3-turbo, gpt-3.5-turbo, claude-3-haiku 等
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
                    <p class="ai-config-card__title">内容翻译</p>
                    <p class="ai-config-card__subtitle">用于全文翻译与标题翻译</p>
                  </div>
                  <div class="ai-config-card__actions">
                    <button class="ghost-btn" type="button" @click="copySummaryToTranslation">
                      沿用摘要配置
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
                      {{ serviceTesting.translation ? '测试中...' : '测试连接' }}
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>API Key</label>
                  <input
                    v-model="localConfig.translation.api_key"
                    type="text"
                    placeholder="输入翻译使用的 API Key"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label>API 地址</label>
                  <input
                    v-model="localConfig.translation.base_url"
                    type="text"
                    placeholder="API Base URL"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label>模型名称</label>
                  <input
                    v-model="localConfig.translation.model_name"
                    type="text"
                    placeholder="例如: glm-4、glm-4-air"
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
            <h3>AI 功能</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.features.auto_summary"
                  type="checkbox"
                  class="form-checkbox"
                />
                自动生成摘要
                <span class="checkbox-hint">新文章自动生成AI摘要</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.features.auto_translation"
                  type="checkbox"
                  class="form-checkbox"
                />
                自动翻译
                <span class="checkbox-hint">新文章自动翻译到指定语言</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.features.auto_title_translation"
                  type="checkbox"
                  class="form-checkbox"
                />
                自动标题翻译
                <span class="checkbox-hint">在原标题下方显示翻译后的标题</span>
              </label>
            </div>

            <div
              class="form-group"
              v-if="localConfig.features.auto_translation || localConfig.features.auto_title_translation"
            >
              <label>翻译目标语言</label>
              <select v-model="localConfig.features.translation_language" class="form-select">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
              </select>
            </div>
          </section>

          <section class="settings-section">
            <h3>订阅更新</h3>
            <div class="form-group">
              <label>
                <input
                  v-model="autoRefresh"
                  type="checkbox"
                  class="form-checkbox"
                />
                自动刷新订阅
              </label>
            </div>

            <div class="form-group">
              <label>刷新间隔（分钟）</label>
              <input
                v-model.number="fetchInterval"
                type="number"
                min="5"
                max="1440"
                class="form-input"
              />
              <p class="form-hint">
                设置RSS订阅的自动刷新间隔（5-1440分钟），推荐720分钟（12小时）
              </p>
            </div>
          </section>

          <section class="settings-section">
            <h3>显示设置</h3>
            <div class="form-group">
              <label>
                <input
                  v-model="enableDateFilter"
                  type="checkbox"
                  class="form-checkbox"
                />
                启用时间过滤
              </label>
              <p class="form-hint">只显示指定时间范围内的文章，提升浏览体验</p>
            </div>

            <div class="form-group" v-if="enableDateFilter">
              <label>默认时间范围</label>
              <select v-model="defaultDateRange" class="form-select">
                <option value="1d">最近1天</option>
                <option value="7d">最近1周</option>
                <option value="30d">最近1个月</option>
                <option value="90d">最近3个月</option>
                <option value="180d">最近6个月</option>
                <option value="365d">最近1年</option>
                <option value="all">全部时间</option>
              </select>
              <p class="form-hint">设置默认显示的文章时间范围</p>
            </div>

            <div class="form-group" v-if="enableDateFilter">
              <label>时间基准</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    v-model="timeField"
                    type="radio"
                    value="inserted_at"
                    class="form-radio"
                  />
                  入库时间（推荐）
                </label>
                <label class="radio-label">
                  <input
                    v-model="timeField"
                    type="radio"
                    value="published_at"
                    class="form-radio"
                  />
                  文章发布时间
                </label>
              </div>
              <p class="form-hint">
                入库时间更可靠，文章发布时间可能有空值
              </p>
            </div>
          </section>

          <section class="settings-section">
            <h3>关于</h3>
            <p class="about-text">
              RSS READER v0.1.0<br />
              本地 RSS 阅读器 + AI 摘要<br />
              <a href="https://github.com" target="_blank">GitHub</a>
            </p>
          </section>
        </div>

        <div class="modal-footer">
          <button @click="handleClose" class="btn btn-secondary">取消</button>
          <button @click="saveSettings" class="btn btn-primary">保存</button>
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
  background: var(--bg-surface, #ffffff);
  color: var(--text-primary, #0f1419);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
}

.settings-section {
  margin-bottom: 32px;
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
  border: 1px dashed var(--border-color, rgba(15, 17, 21, 0.2));
  background: transparent;
  color: var(--text-secondary);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.ghost-btn:hover {
  border-color: var(--accent, #007aff);
  color: var(--accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
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
  padding: 10px 12px;
  border: 1px solid var(--border-color, rgba(15, 17, 21, 0.12));
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-surface, #ffffff);
  color: var(--text-primary, #0f1419);
  transition: border-color 0.2s;
}

.form-input::placeholder {
  color: var(--text-secondary, #6c7384);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--accent);
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
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(120deg, #007aff, #5856d6);
  color: white;
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-btn.loading {
  background: linear-gradient(120deg, #ff9500, #ff7a18);
}

.test-btn.success {
  background: linear-gradient(120deg, #34c759, #30d158);
}

.test-btn.error {
  background: linear-gradient(120deg, #ff3b30, #ff6b6b);
}

.test-result {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.test-result.success {
  background: rgba(52, 199, 89, 0.1);
  color: #34c759;
  border: 1px solid rgba(52, 199, 89, 0.2);
}

.test-result.error {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.2);
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

.about-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.about-text a {
  color: var(--accent);
  text-decoration: none;
}

.about-text a:hover {
  text-decoration: underline;
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
  background: var(--bg-surface, #ffffff);
  color: var(--text-primary, #0f1419);
  border: 1px solid var(--border-color, rgba(15, 17, 21, 0.12));
}

.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.04);
}

.btn-primary {
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 122, 24, 0.3);
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
</style>
