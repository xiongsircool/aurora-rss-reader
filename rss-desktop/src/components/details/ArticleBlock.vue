<script setup lang="ts">
import { computed } from 'vue'
import type { ArticleBlock } from '@/composables/useArticleParser'

const props = defineProps<{
  block: ArticleBlock
  showTranslation: boolean
}>()

const emit = defineEmits<{
  retry: [blockId: string]
}>()

const isTranslatable = computed(() => 
  !props.block.id.startsWith('code_') && 
  !props.block.id.startsWith('empty_') &&
  props.block.text.length > 0
)

const hasTranslation = computed(() => 
  props.block.status === 'success' && 
  props.block.translation && 
  props.block.translation.length > 0
)

const showTranslationBlock = computed(() =>
  props.showTranslation && isTranslatable.value
)
</script>

<template>
  <div class="article-block" :data-block-id="block.id">
    <!-- Original Content -->
    <div 
      class="block-original"
      v-html="block.html"
    />
    
    <!-- Translation Container (only when translation mode is on) -->
    <div 
      v-if="showTranslationBlock"
      class="block-translation"
      :class="{
        'is-loading': block.status === 'loading',
        'is-error': block.status === 'error',
        'is-success': block.status === 'success'
      }"
    >
      <!-- Loading State -->
      <div v-if="block.status === 'loading'" class="translation-loading">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
      
      <!-- Error State -->
      <div v-else-if="block.status === 'error'" class="translation-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ block.error || '翻译失败' }}</span>
        <button 
          class="retry-btn"
          @click="emit('retry', block.id)"
        >
          重试
        </button>
      </div>
      
      <!-- Success State - Show Translation -->
      <div v-else-if="hasTranslation" class="translation-content">
        {{ block.translation }}
      </div>
      
      <!-- Idle State - Waiting -->
      <div v-else-if="block.status === 'idle'" class="translation-idle">
        <span class="idle-icon">⏳</span>
        <span class="idle-text">等待翻译...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.article-block {
  margin-bottom: 0.5em;
}

.block-original {
  /* Preserve original styling */
}

.block-original :deep(p),
.block-original :deep(h1),
.block-original :deep(h2),
.block-original :deep(h3),
.block-original :deep(h4),
.block-original :deep(h5),
.block-original :deep(h6),
.block-original :deep(li),
.block-original :deep(blockquote) {
  margin: 0;
}

.block-translation {
  margin-top: 0.4em;
  margin-bottom: 0.8em;
  padding: 0.6em 0.8em;
  border-left: 3px solid var(--accent-primary, #4C74FF);
  background: var(--bg-elevated, rgba(76, 116, 255, 0.08));
  border-radius: 0 6px 6px 0;
  font-size: 0.95em;
  color: var(--text-secondary, #5F6368);
  transition: all 0.2s ease;
}

.block-translation.is-loading {
  background: var(--bg-elevated, rgba(100, 100, 100, 0.1));
  border-left-color: var(--text-tertiary, #888);
}

.block-translation.is-error {
  background: rgba(220, 53, 69, 0.1);
  border-left-color: #dc3545;
}

.block-translation.is-success {
  background: var(--bg-elevated, rgba(76, 116, 255, 0.08));
}

/* Loading Animation */
.translation-loading {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}

.loading-dot {
  width: 6px;
  height: 6px;
  background: var(--accent-primary, #4C74FF);
  border-radius: 50%;
  animation: loadingPulse 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loadingPulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Error State */
.translation-error {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.error-icon {
  font-size: 1em;
}

.error-text {
  color: #dc3545;
  font-size: 0.9em;
}

.retry-btn {
  padding: 2px 10px;
  font-size: 0.85em;
  background: transparent;
  border: 1px solid var(--accent-primary, #4C74FF);
  color: var(--accent-primary, #4C74FF);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: var(--accent-primary, #4C74FF);
  color: white;
}

/* Idle State */
.translation-idle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary, #888);
  font-size: 0.9em;
}

/* Translation Content */
.translation-content {
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
