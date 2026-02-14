<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>(), {
  title: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  danger: false
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirmButton = ref<HTMLButtonElement | null>(null)

watch(() => props.show, (visible) => {
  if (!visible) return
  nextTick(() => confirmButton.value?.focus())
})

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('cancel')
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      @click="handleBackdropClick"
    >
      <div class="absolute inset-0 bg-black/40"></div>
      <div class="relative w-full max-w-[420px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-2xl">
        <div v-if="title" class="px-5 py-4 border-b border-[var(--border-color)]">
          <h3 class="text-[15px] font-semibold c-[var(--text-primary)]">
            {{ title }}
          </h3>
        </div>
        <div class="px-5 py-4 text-[13px] c-[var(--text-secondary)] whitespace-pre-line">
          {{ message }}
        </div>
        <div class="px-5 py-3 border-t border-[var(--border-color)] flex justify-end gap-2">
          <button
            @click="emit('cancel')"
            class="px-3 py-2 rounded-lg text-[13px] c-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.05)]"
          >
            {{ cancelText }}
          </button>
          <button
            ref="confirmButton"
            @click="emit('confirm')"
            :class="danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--accent)] hover:opacity-90'"
            class="px-4 py-2 rounded-lg text-[13px] font-medium c-white transition-colors"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
