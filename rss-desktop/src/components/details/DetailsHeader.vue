<script setup lang="ts">
import { computed } from 'vue'
import { formatDateDetailed } from '../../utils/date'
import { useSanitize } from '../../composables/useSanitize'
import type { Entry } from '../../types'

const props = defineProps<{
  entry: Entry
  showTranslatedTitle: boolean
  translatedTitle: string | null
}>()

const { sanitizeTitle } = useSanitize()
const safeTitle = computed(() => sanitizeTitle(props.entry.title))
const safeTranslatedTitle = computed(() => sanitizeTitle(props.translatedTitle))
</script>

<template>
  <div class="mb-3">
    <p class="c-[var(--text-secondary)] text-xs m-0">{{ entry.feed_title }}</p>
    <h2 class="my-2 text-2xl leading-tight break-words" v-html="showTranslatedTitle && translatedTitle ? safeTranslatedTitle : safeTitle"></h2>
    <p class="c-[var(--text-secondary)] text-xs m-0">
      {{ entry.author || '未知作者' }} · {{ formatDateDetailed(entry.published_at, entry.inserted_at) }}
    </p>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
