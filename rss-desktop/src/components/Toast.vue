<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  message: string
  type?: 'success' | 'error' | 'info'
}>()

const emit = defineEmits<{
  close: []
}>()

const visible = ref(false)

watch(() => props.show, (newVal) => {
  if (newVal) {
    visible.value = true
    setTimeout(() => {
      emit('close')
    }, 3000)
  } else {
    visible.value = false
  }
})

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return '✓'
    case 'error':
      return '✕'
    default:
      return 'ℹ'
  }
})


</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      class="fixed top-6 right-6 min-w-75 max-w-125 px-5 py-4 rounded-xl bg-[var(--bg-surface)] shadow-xl flex items-center gap-3 z-1000 border border-[var(--border-color)]"
    >
      <span
        class="flex items-center justify-center w-6 h-6 rounded-full font-bold shrink-0 c-white"
        :class="{
          'bg-[#34c759]': type === 'success',
          'bg-[#ff3b30]': type === 'error',
          'bg-[#007aff]': !type || type === 'info'
        }"
      >{{ icon }}</span>
      <span class="flex-1 text-sm c-[var(--text-primary)]">{{ message }}</span>
      <button
        @click="emit('close')"
        class="border-none bg-transparent cursor-pointer text-base c-[var(--text-secondary)] p-1 flex items-center justify-center rounded transition-colors duration-200 hover:bg-[rgba(0,0,0,0.05)]"
      >✕</button>
    </div>
  </Transition>
</template>

<style scoped>
/* Vue transition animations - must remain in CSS */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
</style>
