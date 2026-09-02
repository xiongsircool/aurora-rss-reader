<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  content: string
  renderMath?: boolean
}>()

const containerRef = ref<HTMLElement | null>(null)
const safeHtml = ref('')
let renderToken = 0
let markdownRuntimePromise: Promise<{
  sanitize: (content: string) => string
  parse: (content: string) => string
}> | null = null
let mathRuntimePromise: Promise<(element: HTMLElement, options: Record<string, unknown>) => void> | null = null

const allowedTags = [
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
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]

const allowedAttrs = ['href', 'title', 'target', 'rel', 'class', 'entry_id', 'data-entry-id', 'data-index']

function getMarkdownRuntime() {
  if (!markdownRuntimePromise) {
    markdownRuntimePromise = Promise.all([
      import('dompurify'),
      import('marked'),
    ]).then(([domPurifyModule, markedModule]) => {
      const DOMPurify = domPurifyModule.default
      const { marked } = markedModule

      marked.setOptions({
        gfm: true,
        breaks: true,
      })

      return {
        sanitize: (content: string) => DOMPurify.sanitize(content, {
          ALLOWED_TAGS: allowedTags,
          ALLOWED_ATTR: allowedAttrs,
          KEEP_CONTENT: true,
        }),
        parse: (content: string) => marked.parse(content) as string,
      }
    })
  }

  return markdownRuntimePromise
}

function getMathRuntime() {
  if (!mathRuntimePromise) {
    mathRuntimePromise = Promise.all([
      import('katex/dist/katex.min.css'),
      import('katex/contrib/auto-render'),
    ]).then(([, katexModule]) => katexModule.default)
  }

  return mathRuntimePromise
}

function hasMathSyntax(content: string) {
  return /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)|(\\\[[\s\S]+?\\\])|(\\\([\s\S]+?\\\))/.test(content)
}

async function renderMath() {
  await nextTick()

  if (!containerRef.value) {
    return
  }

  const renderMathInElement = await getMathRuntime()

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

async function renderContent() {
  const currentToken = ++renderToken
  const content = props.content?.trim()

  if (!content) {
    safeHtml.value = ''
    return
  }

  const runtime = await getMarkdownRuntime()
  if (currentToken !== renderToken) {
    return
  }

  safeHtml.value = runtime.sanitize(runtime.parse(content))

  if (!props.renderMath || !hasMathSyntax(content)) {
    return
  }

  if (currentToken !== renderToken) {
    return
  }

  await renderMath()
}

watch(() => [props.content, props.renderMath], () => {
  void renderContent()
}, { immediate: true })
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
