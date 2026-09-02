<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RotateCw, Sparkles } from 'lucide-vue-next'
import { renderMarkdown } from '../../composables/useSanitize'
import { useAiStore } from '../../stores/aiStore'
import { useReaderStore } from '../../stores/readerStore'
import { useSettingsStore } from '../../stores/settingsStore'

const ai = useAiStore()
const reader = useReaderStore()
const settings = useSettingsStore()

// The panel always reflects the currently-open reader entry.
const entryId = computed(() => reader.row?.id ?? '')
const s = computed(() => ai.state(entryId.value || '__none__'))
const html = computed(() => renderMarkdown(s.value.summary))

const language = computed(() => settings.ai.language || 'zh-CN')

async function generate() {
  if (reader.row) await ai.summarize(reader.row)
}

async function regenerate() {
  if (reader.row) await ai.summarize(reader.row, { force: true })
}

onMounted(async () => {
  if (!settings.loaded) await settings.load()
  if (entryId.value) await ai.loadCached(entryId.value, language.value)
})

// Reload cache when the open entry changes.
watch(entryId, async (id) => {
  if (id) await ai.loadCached(id, language.value)
})
</script>

<template>
  <section class="ai-summary">
    <header class="ai-summary__head">
      <Sparkles :size="15" />
      <span>AI Summary</span>
      <button
        v-if="s.summary && !s.summaryLoading"
        class="ai-summary__regen"
        type="button"
        aria-label="Regenerate"
        @click="regenerate"
      >
        <RotateCw :size="13" />
      </button>
    </header>

    <p v-if="s.summaryLoading" class="ai-summary__status">Generating…</p>
    <p v-else-if="s.error" class="ai-summary__error">{{ s.error }}</p>
    <div v-else-if="s.summary" class="ai-summary__body markdown-body" v-html="html" />
    <button v-else class="ai-summary__generate" type="button" @click="generate">
      <Sparkles :size="15" />
      Generate summary
    </button>
  </section>
</template>
