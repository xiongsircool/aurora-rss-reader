<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  addingFeed: boolean
  targetGroupName?: string | null
}>()

const emit = defineEmits<{
  (e: 'add-feed', url: string): void
}>()

const { t } = useI18n()
const newFeedUrl = ref('')

const groupHint = computed(() => {
  if (props.targetGroupName) {
    return t('feeds.addToGroup', { groupName: props.targetGroupName })
  }
  return t('feeds.addToDefault')
})

function handleSubmit() {
  if (!newFeedUrl.value) return
  emit('add-feed', newFeedUrl.value)
  newFeedUrl.value = ''
}
</script>

<template>
  <div class="my-4">
    <form class="flex gap-2" @submit.prevent="handleSubmit">
      <input
        v-model.trim="newFeedUrl"
        :placeholder="t('feeds.addPlaceholder')"
        class="flex-1 border border-[var(--border-color)] rounded-lg px-3 py-2 bg-[var(--bg-surface)] c-[var(--text-primary)] transition-all duration-200 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(255,122,24,0.18)]"
      />
      <button
        type="submit"
        :disabled="addingFeed"
        class="border-none bg-gradient-to-r from-[#ff7a18] to-[#ffbe30] c-white px-3 rounded-lg cursor-pointer disabled:op-60 disabled:cursor-not-allowed"
      >
        {{ addingFeed ? t('feeds.adding') : t('feeds.addFeed') }}
      </button>
    </form>
    <p class="text-xs c-[var(--text-secondary)] mt-1.5 ml-1">
      {{ groupHint }}
    </p>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
