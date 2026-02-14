<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  addingFeed: boolean
  targetGroupName?: string | null
}>()

const emit = defineEmits<{
  (e: 'add-feed', url: string): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const newFeedUrl = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

function handleSubmit() {
  if (!newFeedUrl.value) return
  emit('add-feed', newFeedUrl.value)
  newFeedUrl.value = ''
  emit('close')
}

function handleClickOutside(e: MouseEvent) {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    ref="popoverRef"
    class="absolute left-0 right-0 top-full mt-1 z-50 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]"
  >
    <form class="flex gap-2" @submit.prevent="handleSubmit">
      <input
        ref="inputRef"
        v-model.trim="newFeedUrl"
        :placeholder="t('feeds.addPlaceholder')"
        class="flex-1 border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[12px] bg-[var(--bg-base)] c-[var(--text-primary)] transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(255,122,24,0.18)]"
      />
      <button
        type="submit"
        :disabled="addingFeed || !newFeedUrl"
        class="border-none bg-gradient-to-r from-[#ff7a18] to-[#ffbe30] c-white px-2.5 py-1.5 rounded-lg text-[12px] cursor-pointer font-medium whitespace-nowrap disabled:op-50 disabled:cursor-not-allowed"
      >
        {{ addingFeed ? t('feeds.adding') : t('feeds.addFeed') }}
      </button>
    </form>
    <p v-if="targetGroupName" class="text-[11px] c-[var(--text-tertiary)] mt-1.5 ml-0.5">
      {{ t('feeds.addToGroup', { groupName: targetGroupName }) }}
    </p>
  </div>
</template>
