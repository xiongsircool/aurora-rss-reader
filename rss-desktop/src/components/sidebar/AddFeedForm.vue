<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  addingFeed: boolean
}>()

const emit = defineEmits<{
  (e: 'add-feed', url: string): void
}>()

const { t } = useI18n()
const newFeedUrl = ref('')

function handleSubmit() {
  if (!newFeedUrl.value) return
  emit('add-feed', newFeedUrl.value)
  newFeedUrl.value = ''
}
</script>

<template>
  <form class="add-feed" @submit.prevent="handleSubmit">
    <input v-model.trim="newFeedUrl" :placeholder="t('feeds.addPlaceholder')" />
    <button type="submit" :disabled="addingFeed">
      {{ addingFeed ? t('feeds.adding') : t('feeds.addFeed') }}
    </button>
  </form>
</template>

<style scoped>
.add-feed {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.add-feed input {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.add-feed input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 122, 24, 0.18);
}

.add-feed button {
  border: none;
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: #fff;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;
}

.add-feed button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
