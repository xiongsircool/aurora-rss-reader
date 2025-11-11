<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAIStore } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const aiStore = useAIStore()
const settingsStore = useSettingsStore()

// 本地表单数据
const localConfig = ref({
  api_key: '',
  base_url: 'https://open.bigmodel.cn/api/paas/v4/',
  model_name: 'glm-4-flash',
  auto_summary: false,
  auto_translation: false,
  auto_title_translation: false,
  translation_language: 'zh'
})

const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

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


// 监听store配置变化
watch(() => aiStore.config, (newConfig) => {
  localConfig.value = { ...localConfig.value, ...newConfig }
}, { deep: true })

// 监听模态框显示状态
watch(() => props.show, async (show) => {
  if (show) {
    await Promise.all([
      aiStore.fetchConfig(),
      settingsStore.fetchSettings()
    ])
    testResult.value = null
  }
})

async function testConnection() {
  if (!localConfig.value.api_key || !localConfig.value.base_url || !localConfig.value.model_name) {
    testResult.value = { success: false, message: '请先完善API配置' }
    return
  }

  isTesting.value = true
  testResult.value = null

  try {
    const success = await aiStore.testConnection()
    testResult.value = {
      success,
      message: success ? '连接测试成功！' : aiStore.error || '连接测试失败'
    }
  } catch (error) {
    testResult.value = { success: false, message: '连接测试失败' }
  } finally {
    isTesting.value = false
  }
}

async function saveSettings() {
  const success = await aiStore.updateConfig(localConfig.value)
  if (success) {
    emit('close')
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
            <h3>AI 配置</h3>
            <div class="form-group">
              <label>API Key</label>
              <input
                v-model="localConfig.api_key"
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
                v-model="localConfig.base_url"
                type="text"
                placeholder="API Base URL"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>模型名称</label>
              <input
                v-model="localConfig.model_name"
                type="text"
                placeholder="例如: glm-4-flash"
                class="form-input"
              />
              <p class="form-hint">
                支持模型: glm-4-flash, glm-4, glm-4-air, glm-3-turbo, gpt-3.5-turbo, claude-3-haiku 等
              </p>
            </div>

            <div class="form-group">
              <button
                @click="testConnection"
                :disabled="isTesting || !localConfig.api_key || !localConfig.base_url || !localConfig.model_name"
                class="test-btn"
                :class="{ loading: isTesting, success: testResult?.success, error: testResult?.success === false }"
              >
                {{ isTesting ? '测试中...' : '测试连接' }}
              </button>
              <div v-if="testResult" class="test-result" :class="{ success: testResult.success, error: !testResult.success }">
                {{ testResult.message }}
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3>AI 功能</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="localConfig.auto_summary"
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
                  v-model="localConfig.auto_translation"
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
                  v-model="localConfig.auto_title_translation"
                  type="checkbox"
                  class="form-checkbox"
                />
                自动标题翻译
                <span class="checkbox-hint">在原标题下方显示翻译后的标题</span>
              </label>
            </div>

            <div
              class="form-group"
              v-if="localConfig.auto_translation || localConfig.auto_title_translation"
            >
              <label>翻译目标语言</label>
              <select v-model="localConfig.translation_language" class="form-select">
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
                设置RSS订阅的自动刷新间隔（5-1440分钟）
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
