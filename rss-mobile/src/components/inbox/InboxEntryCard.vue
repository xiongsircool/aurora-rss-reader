<script setup lang="ts">
import { computed } from 'vue'
import { Bookmark, CirclePlay, Images, Newspaper } from 'lucide-vue-next'
import { formatRelativeTime } from '../../utils/date'
import SourceAvatar from '../common/SourceAvatar.vue'
import type { InboxEntry } from '../../types'

const props = defineProps<{
  entry: InboxEntry
}>()

const emit = defineEmits<{
  (event: 'toggle-saved', id: string): void
}>()

const typeLabel = computed(() => {
  if (props.entry.content_type === 'gallery') return `${props.entry.image_count || 0} images`
  if (props.entry.content_type === 'image') return 'Image'
  if (props.entry.content_type === 'video') return props.entry.video?.duration || 'Video'
  if (props.entry.content_type === 'audio') return 'Audio'
  return props.entry.reading_time_minutes ? `${props.entry.reading_time_minutes} min` : 'Article'
})

const typeIcon = computed(() => {
  if (props.entry.content_type === 'gallery' || props.entry.content_type === 'image') return Images
  if (props.entry.content_type === 'video') return CirclePlay
  return Newspaper
})

const thumbnailUrl = computed(() => props.entry.video?.thumbnail_url || props.entry.lead_image_url)
</script>

<template>
  <article class="entry-card" :class="{ 'entry-card--unread': !entry.read }">
    <RouterLink :to="`/entries/${entry.id}`" class="entry-card__main">
      <div class="entry-card__meta">
        <SourceAvatar :name="entry.feed_title" :favicon-url="entry.feed_favicon_url" :size="22" />
        <span class="entry-card__source">{{ entry.feed_title || 'Untitled source' }}</span>
        <span class="entry-card__time">{{ formatRelativeTime(entry.published_at, entry.inserted_at) }}</span>
        <span v-if="!entry.read" class="unread-dot" aria-label="Unread" />
      </div>

      <div class="entry-card__body">
        <div class="entry-card__text">
          <h2>{{ entry.title || 'Untitled entry' }}</h2>
          <p v-if="entry.preview_text">{{ entry.preview_text }}</p>
          <div class="entry-card__type">
            <component :is="typeIcon" :size="14" />
            <span>{{ typeLabel }}</span>
          </div>
        </div>

        <div v-if="thumbnailUrl" class="entry-card__thumb">
          <img :src="thumbnailUrl" :alt="entry.title || ''" loading="lazy" decoding="async">
          <span v-if="entry.content_type === 'video'" class="entry-card__play">
            <CirclePlay :size="18" fill="currentColor" />
          </span>
        </div>
      </div>
    </RouterLink>

    <button
      class="icon-button entry-card__save"
      type="button"
      :aria-label="entry.starred ? 'Remove from saved' : 'Save entry'"
      @click="emit('toggle-saved', entry.id)"
    >
      <Bookmark :size="18" :fill="entry.starred ? 'currentColor' : 'none'" />
    </button>
  </article>
</template>
