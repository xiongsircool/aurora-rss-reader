<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  importLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'export'): void
  (e: 'import', file: File): void
}>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  emit('import', file)
  if (target) target.value = ''
}
</script>

<template>
  <div class="flex gap-2 mb-4">
    <button
      @click="emit('export')"
      class="flex-1 border border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] p-2 rounded-lg cursor-pointer text-xs transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:border-[var(--accent)]"
    >
      {{ t('opml.export') }}
    </button>
    <button
      @click="triggerImport"
      :disabled="importLoading"
      class="flex-1 border border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] p-2 rounded-lg cursor-pointer text-xs transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:border-[var(--accent)] disabled:op-50 disabled:cursor-not-allowed"
    >
      {{ importLoading ? t('toast.importing') : t('opml.import') }}
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".opml,.xml"
      @change="handleFileChange"
      class="hidden"
    />
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
