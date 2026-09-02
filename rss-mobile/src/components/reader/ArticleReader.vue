<script setup lang="ts">
import { computed } from 'vue'
import AISummaryPanel from './AISummaryPanel.vue'
import { sanitizeHtml } from '../../composables/useSanitize'
import type { ReaderEntry } from '../../types'

const props = defineProps<{
  entry: ReaderEntry
}>()

const safeHtml = computed(() => sanitizeHtml(props.entry.presentation.reader_html || props.entry.summary))
</script>

<template>
  <article class="reader-template">
    <AISummaryPanel />
    <div class="article-body" v-html="safeHtml" />
  </article>
</template>
