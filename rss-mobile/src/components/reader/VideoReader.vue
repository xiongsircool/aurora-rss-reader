<script setup lang="ts">
import { computed, ref } from 'vue'
import { CirclePlay, ExternalLink, FileText } from 'lucide-vue-next'
import AISummaryPanel from './AISummaryPanel.vue'
import { sanitizeHtml } from '../../composables/useSanitize'
import { openUrl } from '../../utils/openUrl'
import type { ReaderEntry } from '../../types'

const props = defineProps<{
  entry: ReaderEntry
}>()

const video = computed(() => props.entry.presentation.video)
const coverUrl = computed(() => video.value?.thumbnail_url || props.entry.presentation.lead_image_url)
const descriptionHtml = computed(() => sanitizeHtml(props.entry.presentation.reader_html || props.entry.summary || props.entry.presentation.preview_text))
const hasTranscript = computed(() => !!descriptionHtml.value)

// We don't autoplay (design rule); embedded playback is unreliable on mobile,
// so the primary action opens the original video. Transcript is revealed inline.
const showTranscript = ref(false)

function openVideo() {
  void openUrl(video.value?.url || props.entry.url)
}
</script>

<template>
  <article class="reader-template video-reader">
    <button class="video-cover" type="button" @click="openVideo">
      <img v-if="coverUrl" :src="coverUrl" :alt="entry.title || ''">
      <span v-else class="video-cover__placeholder" />
      <span class="video-cover__play">
        <CirclePlay :size="54" fill="currentColor" />
      </span>
      <span v-if="video?.duration" class="video-cover__duration">{{ video.duration }}</span>
    </button>

    <AISummaryPanel />

    <div class="video-reader__fallbacks">
      <button class="primary-button" type="button" @click="openVideo">
        <ExternalLink :size="16" />
        Open video
      </button>
      <button v-if="hasTranscript" class="ghost-button" type="button" @click="showTranscript = !showTranscript">
        <FileText :size="16" />
        {{ showTranscript ? 'Hide transcript' : 'Read transcript' }}
      </button>
    </div>

    <div v-if="showTranscript && descriptionHtml" class="article-body video-reader__transcript" v-html="descriptionHtml" />
  </article>
</template>
