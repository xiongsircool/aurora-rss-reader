<script setup lang="ts">
import DOMPurify from 'dompurify'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'
import { marked } from 'marked'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  content: string
}>()

const containerRef = ref<HTMLElement | null>(null)

marked.setOptions({
  gfm: true,
  breaks: true,
})

const safeHtml = computed(() => {
  const content = props.content?.trim()
  if (!content) {
    return ''
  }

  const rendered = marked.parse(content) as string
  return DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS: [
      'a',
      'blockquote',
      'br',
      'code',
      'del',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'li',
      'ol',
      'p',
      'pre',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    KEEP_CONTENT: true,
  })
})

async function renderMath() {
  await nextTick()

  if (!containerRef.value) {
    return
  }

  renderMathInElement(containerRef.value, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
    ],
    throwOnError: false,
    strict: 'ignore',
  })
}

watch(safeHtml, () => {
  void renderMath()
})

onMounted(() => {
  void renderMath()
})
</script>

<template>
  <div
    ref="containerRef"
    class="markdown-content"
    v-html="safeHtml"
  />
</template>

<style scoped>
.markdown-content {
  font-size: 0.95rem;
  line-height: 1.75;
  color: var(--text-primary);
}

.markdown-content :deep(*:first-child) {
  margin-top: 0;
}

.markdown-content :deep(*:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(p),
.markdown-content :deep(ul),
.markdown-content :deep(ol),
.markdown-content :deep(blockquote),
.markdown-content :deep(pre),
.markdown-content :deep(table) {
  margin: 0 0 0.75rem;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 1rem 0 0.5rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-primary);
}

.markdown-content :deep(h1) {
  font-size: 1.1rem;
}

.markdown-content :deep(h2) {
  font-size: 1.02rem;
}

.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  font-size: 0.96rem;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.15rem;
}

.markdown-content :deep(li + li) {
  margin-top: 0.35rem;
}

.markdown-content :deep(blockquote) {
  padding: 0.65rem 0.8rem;
  border-left: 3px solid color-mix(in srgb, var(--accent) 70%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-base));
  border-radius: 0.7rem;
  color: var(--text-secondary);
}

.markdown-content :deep(code) {
  padding: 0.12rem 0.35rem;
  border-radius: 0.35rem;
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  font-size: 0.88em;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
}

.markdown-content :deep(pre) {
  padding: 0.85rem 1rem;
  overflow-x: auto;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--text-primary) 7%, var(--bg-base));
}

.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-content :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-color);
  text-align: left;
  vertical-align: top;
}

.markdown-content :deep(hr) {
  margin: 1rem 0;
  border: 0;
  border-top: 1px solid var(--border-color);
}

.markdown-content :deep(.katex-display) {
  margin: 0.9rem 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.markdown-content :deep(.katex) {
  font-size: 1.02em;
}
</style>
