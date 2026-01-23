<script setup lang="ts">
import { computed } from 'vue'
import type { ContentBlock } from '../../composables/useArticleParser'
import { useSanitize } from '../../composables/useSanitize'

const props = defineProps<{
  blocks: ContentBlock[]
  showTranslation: boolean
  getTranslation: (blockId: string) => string | null
  isBlockLoading: (blockId: string) => boolean
  isBlockFailed: (blockId: string) => boolean
}>()

type RenderBlock = ContentBlock & { safeHtml: string }

const { sanitize } = useSanitize()

// 过滤掉 skip 类型的块，并清理 HTML
const visibleBlocks = computed<RenderBlock[]>(() => (
  props.blocks
    .filter((block) => block.type !== 'skip')
    .map((block) => ({
      ...block,
      safeHtml: sanitize(block.html),
    }))
))
</script>

<template>
  <article class="article-content">
    <div v-for="block in visibleBlocks" :key="block.id" class="content-block">
      <!-- 原文 -->
      <div v-html="block.safeHtml" class="original" />

      <!-- 翻译区域（仅 text 类型且开启显示时渲染） -->
      <div v-if="block.type === 'text' && showTranslation" class="translation-wrapper">
        <!-- 骨架屏 -->
        <div v-if="isBlockLoading(block.id)" class="skeleton">
          <div class="skeleton-line" />
          <div class="skeleton-line short" />
        </div>

        <!-- 翻译内容 -->
        <div v-else-if="getTranslation(block.id)" class="translated-text">
          {{ getTranslation(block.id) }}
        </div>

        <!-- 翻译失败 -->
        <div v-else-if="isBlockFailed(block.id)" class="translation-error">
          翻译失败
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.article-content {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--text-primary);
}

.content-block {
  margin-bottom: 0.5em;
}

.original :deep(p),
.original :deep(h1),
.original :deep(h2),
.original :deep(h3),
.original :deep(h4),
.original :deep(h5),
.original :deep(h6),
.original :deep(li),
.original :deep(blockquote) {
  margin: 0;
}

.original :deep(p) {
  margin-bottom: 0.5em;
}

.original :deep(h1),
.original :deep(h2),
.original :deep(h3),
.original :deep(h4),
.original :deep(h5),
.original :deep(h6) {
  margin-top: 0.8em;
  margin-bottom: 0.4em;
  font-weight: 600;
}

.original :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

.original :deep(pre) {
  background: var(--bg-elevated);
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
}

.original :deep(code) {
  background: var(--bg-elevated);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

.original :deep(a) {
  color: var(--accent-primary, #4c74ff);
  text-decoration: none;
}

.original :deep(a:hover) {
  text-decoration: underline;
}

/* 翻译区域样式 */
.translation-wrapper {
  margin-top: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border-radius: 6px;
}

.translated-text {
  color: var(--text-secondary);
  font-size: 0.95em;
  line-height: 1.7;
}

.translation-error {
  color: #e53935;
  font-size: 0.9em;
  font-style: italic;
}

/* 骨架屏样式 */
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 1em;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line.short {
  width: 60%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 暗色模式 */
:global(.dark) .skeleton-line {
  background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
  background-size: 200% 100%;
}

:global(.dark) .translation-wrapper {
  background: rgba(255, 255, 255, 0.05);
}
</style>
