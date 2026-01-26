# 前端修改方案

## 修改文件 5: rss-desktop/src/components/settings/SettingsAIConfig.vue

### 修改 1: 添加 props 定义

在第 7-10 行的 defineProps 中添加：

```vue
<script setup lang="ts">
// ... 其他 imports

defineProps<{
  serviceTesting: Record<AIServiceKey, boolean>
  serviceTestResult: Record<AIServiceKey, TestResult | null>
  rebuildingVectors: boolean        // 新增
  rebuildResult: TestResult | null  // 新增
}>()
```

### 修改 2: 添加 emit 定义

在第 12-15 行的 defineEmits 中添加：

```vue
const emit = defineEmits<{
  testConnection: [service: AIServiceKey]
  copySummaryToTranslation: []
  rebuildVectors: []  // 新增
}>()
```

### 修改 3: 在 Embedding 卡片中添加重建按钮

找到第 166-185 行的 Embedding Config Card，修改按钮区域：

```vue
<!-- Embedding Config Card -->
<div class="border border-[var(--border-color)] rounded-xl p-4 bg-[var(--bg-surface)] flex flex-col justify-between h-full">
  <div class="flex-1">
    <div class="flex justify-between items-center gap-3 mb-3 flex-wrap min-h-[52px]">
      <div>
        <p class="m-0 text-[15px] font-semibold text-[var(--text-primary)]">{{ t('settings.knowledgeBase') }}</p>
        <p class="m-[4px_0_0_0] text-[13px] text-[var(--text-secondary)]">{{ t('settings.embeddingSubtitle') }}</p>
      </div>

      <!-- 按钮组 - 新增重建按钮 -->
      <div class="flex gap-2 items-center flex-wrap justify-end">
        <button
          @click="emit('rebuildVectors')"
          :disabled="rebuildingVectors || !embeddingConfig.api_key"
          class="border border-dashed border-blue-500/40 bg-blue-500/10 text-blue-600 p-[7px_12px] rounded-lg text-[13px] cursor-pointer transition-all hover:bg-blue-500/20 hover:border-blue-600 hover:text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/8 dark:text-blue-400 dark:hover:bg-blue-500/15 dark:hover:border-blue-400 disabled:op-60 disabled:cursor-not-allowed"
          type="button"
        >
          {{ rebuildingVectors ? t('settings.rebuildingVectors') : t('settings.rebuildVectors') }}
        </button>

        <button
          @click="emit('testConnection', 'embedding')"
          :disabled="serviceTesting.embedding || !embeddingConfig.api_key || !embeddingConfig.base_url || !embeddingConfig.model_name"
          class="border-none p-[10px_18px] rounded-[10px] text-sm font-semibold cursor-pointer transition-transform,opacity bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_10px_20px_rgba(255,122,24,0.25)] hover:not-disabled:-translate-y-px hover:not-disabled:op-95 disabled:op-60 disabled:cursor-not-allowed disabled:shadow-none"
          :class="{
            'op-70 transform-none': serviceTesting.embedding,
            'bg-[#34c759]! shadow-none!': serviceTestResult.embedding?.success,
            'bg-[#ff4d4f]! shadow-none!': serviceTestResult.embedding?.success === false
          }"
        >
          {{ serviceTesting.embedding ? t('common.testing') : t('settings.testConnection') }}
        </button>
      </div>
    </div>

    <!-- API Key 输入框 -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
      <input
        v-model="embeddingConfig.api_key"
        type="password"
        :placeholder="t('settings.apiKeyPlaceholder')"
        class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
    </div>

    <!-- API URL 输入框 -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
      <input
        v-model="embeddingConfig.base_url"
        type="text"
        :placeholder="t('settings.apiUrlPlaceholder')"
        class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
    </div>

    <!-- Model Name 输入框 -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
      <input
        v-model="embeddingConfig.model_name"
        type="text"
        :placeholder="t('settings.modelPlaceholder')"
        class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.embeddingModelHint') }}</p>
    </div>
  </div>

  <!-- 测试连接结果 -->
  <div
    v-if="serviceTestResult.embedding"
    class="mt-2 p-3 rounded-[10px] text-[13px] font-medium border border-transparent bg-[var(--bg-elevated)] shadow-[0_10px_20px_rgba(15,20,25,0.08)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
    :class="{
      'text-[#0f7a39] border-[rgba(52,199,89,0.35)]': serviceTestResult.embedding.success,
      'text-[#c43838] border-[rgba(255,77,79,0.35)]': !serviceTestResult.embedding.success
    }"
  >
    {{ serviceTestResult.embedding.message }}
  </div>

  <!-- 重建结果 - 新增 -->
  <div
    v-if="rebuildResult"
    class="mt-2 p-3 rounded-[10px] text-[13px] font-medium border border-transparent bg-[var(--bg-elevated)] shadow-[0_10px_20px_rgba(15,20,25,0.08)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
    :class="{
      'text-[#0f7a39] border-[rgba(52,199,89,0.35)]': rebuildResult.success,
      'text-[#c43838] border-[rgba(255,77,79,0.35)]': !rebuildResult.success
    }"
  >
    {{ rebuildResult.message }}
  </div>
</div>
```

---

## 修改文件 6: rss-desktop/src/i18n/locales/zh-CN.json

### 在 settings 部分添加新的翻译键

找到 "settings" 对象，添加以下键值对：

```json
{
  "settings": {
    "knowledgeBase": "知识库",
    "embeddingSubtitle": "语义搜索向量化",
    "embeddingModelHint": "推荐使用 text-embedding-3-small 或兼容模型",
    "rebuildVectors": "重建向量库",
    "rebuildingVectors": "重建中...",
    "rebuildVectorsSuccess": "向量库重建成功！共处理 {processed} 条，失败 {failed} 条",
    "rebuildVectorsFailed": "向量库重建失败",
    "rebuildVectorsConfirm": "确定要重建向量数据库吗？\n\n这将清除现有向量并重新处理所有文章标题。\n根据文章数量，可能需要几分钟时间。"
  }
}
```

---

## 修改文件 7: 父组件调用（SettingsModal.vue 或类似文件）

### 需要传递新的 props 和处理新的 emit

找到使用 `SettingsAIConfig` 组件的地方，添加新的绑定：

```vue
<SettingsAIConfig
  v-model:summary-config="localConfig.summary"
  v-model:translation-config="localConfig.translation"
  v-model:embedding-config="localConfig.embedding"
  :service-testing="serviceTesting"
  :service-test-result="serviceTestResult"
  :rebuilding-vectors="rebuildingVectors"
  :rebuild-result="rebuildResult"
  @test-connection="testConnection"
  @copy-summary-to-translation="copySummaryToTranslation"
  @rebuild-vectors="rebuildVectors"
/>
```

并在 script 部分使用 composable：

```typescript
const {
  serviceTesting,
  serviceTestResult,
  testConnection,
  copySummaryToTranslation,
  resetTestResults,
  rebuildingVectors,
  rebuildResult,
  rebuildVectors
} = useAIConfigSettings(localConfig)
```

---

## 总结

### 前端改动清单
1. ✅ aiStore.ts - 添加 `rebuildVectors()` 和 `getVectorStats()` 方法
2. ✅ useAIConfigSettings.ts - 添加重建逻辑和状态管理
3. ✅ SettingsAIConfig.vue - 添加重建按钮和结果显示
4. ✅ zh-CN.json - 添加国际化文本

### 用户体验
1. 点击"重建向量库"按钮
2. 弹出确认对话框
3. 显示"重建中..."状态
4. 完成后显示成功/失败消息（5秒后自动消失）
5. 可以在重建过程中看到后端日志输出进度

### 注意事项
- 重建过程中按钮会被禁用
- 需要先配置 Embedding API 才能使用重建功能
- 重建会清空现有向量数据
- 使用批量 API，性能提升显著
