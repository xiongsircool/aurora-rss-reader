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
  <div class="opml-actions">
    <button @click="emit('export')" class="opml-btn">{{ t('opml.export') }}</button>
    <button @click="triggerImport" :disabled="importLoading" class="opml-btn">
      {{ importLoading ? t('toast.importing') : t('opml.import') }}
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".opml,.xml"
      @change="handleFileChange"
      style="display: none"
    />
  </div>
</template>

<style scoped>
.opml-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.opml-btn {
  flex: 1;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.opml-btn:hover {
  background: rgba(255, 122, 24, 0.08);
  border-color: var(--accent);
}

.opml-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
