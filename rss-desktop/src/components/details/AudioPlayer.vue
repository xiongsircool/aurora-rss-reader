<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMediaControls } from '@vueuse/core'

const props = defineProps<{
  src: string
  duration?: string | null
  imageUrl?: string | null
  title?: string | null
}>()

const audioRef = ref<HTMLAudioElement>()
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

const {
  playing,
  currentTime,
  duration: mediaDuration,
  waiting,
  rate,
} = useMediaControls(audioRef, { src: computed(() => props.src) })

// Format time (seconds to MM:SS or HH:MM:SS)
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Parse duration string (HH:MM:SS or MM:SS or seconds)
function parseDuration(dur: string | null | undefined): number {
  if (!dur) return 0
  if (dur.includes(':')) {
    const parts = dur.split(':').map(Number)
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
  }
  return parseInt(dur, 10) || 0
}

const totalDuration = computed(() => {
  if (mediaDuration.value > 0) return mediaDuration.value
  return parseDuration(props.duration)
})

const progress = computed(() => {
  if (totalDuration.value <= 0) return 0
  return (currentTime.value / totalDuration.value) * 100
})

const displayDuration = computed(() => {
  if (totalDuration.value > 0) return formatTime(totalDuration.value)
  if (props.duration) return props.duration
  return '0:00'
})

function togglePlay() {
  playing.value = !playing.value
}

function seek(e: MouseEvent) {
  if (totalDuration.value <= 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  currentTime.value = percent * totalDuration.value
}

function skipForward() {
  currentTime.value = Math.min(currentTime.value + 15, totalDuration.value)
}

function skipBackward() {
  currentTime.value = Math.max(currentTime.value - 15, 0)
}

function cyclePlaybackRate() {
  const idx = playbackRates.indexOf(rate.value)
  const nextIdx = (idx + 1) % playbackRates.length
  rate.value = playbackRates[nextIdx]
}

// Reset when src changes
watch(() => props.src, () => {
  playing.value = false
  currentTime.value = 0
})
</script>

<template>
  <div class="audio-player">
    <audio ref="audioRef" />

    <!-- Podcast style card -->
    <div class="player-card">
      <!-- Cover image or icon -->
      <div class="cover">
        <img v-if="imageUrl" :src="imageUrl" alt="" class="cover-img" />
        <div v-else class="cover-placeholder">
          <span class="podcast-icon">🎙️</span>
        </div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- Title -->
        <div v-if="title" class="title">{{ title }}</div>

        <!-- Progress bar -->
        <div class="progress-container" @click="seek">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <div class="time-display">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ displayDuration }}</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button class="skip-btn" @click="skipBackward" title="Back 15s">
            <span class="skip-text">15</span>
            <span class="skip-arrow">↺</span>
          </button>

          <button class="play-btn" @click="togglePlay">
            <span v-if="waiting" class="loading-spinner" />
            <span v-else-if="playing" class="pause-icon" />
            <span v-else class="play-icon" />
          </button>

          <button class="skip-btn" @click="skipForward" title="Forward 15s">
            <span class="skip-arrow">↻</span>
            <span class="skip-text">15</span>
          </button>

          <button class="rate-btn" @click="cyclePlaybackRate">
            {{ rate }}x
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-player {
  margin-bottom: 1rem;
}

.player-card {
  display: flex;
  gap: 14px;
  padding: 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%);
  border: 1px solid var(--border-color);
}

.cover {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.podcast-icon {
  font-size: 32px;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-container {
  cursor: pointer;
  padding: 4px 0;
}

.progress-track {
  height: 6px;
  background: rgba(128, 128, 128, 0.2);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.1s ease;
}

.time-display {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.skip-btn {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.skip-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.skip-text {
  font-weight: 600;
}

.skip-arrow {
  font-size: 14px;
}

.play-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.play-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.play-icon {
  width: 0;
  height: 0;
  border-left: 10px solid white;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  margin-left: 2px;
}

.pause-icon {
  display: flex;
  gap: 3px;
}

.pause-icon::before,
.pause-icon::after {
  content: '';
  width: 3px;
  height: 12px;
  background: white;
  border-radius: 1px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rate-btn {
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.rate-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
</style>
