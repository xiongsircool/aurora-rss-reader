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

const colorClass = computed(() => {
  switch (props.type) {
    case 'success':
      return 'toast--success'
    case 'error':
      return 'toast--error'
    default:
      return 'toast--info'
  }
})
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" :class="['toast', colorClass]">
      <span class="toast__icon">{{ icon }}</span>
      <span class="toast__message">{{ message }}</span>
      <button @click="emit('close')" class="toast__close">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  min-width: 300px;
  max-width: 500px;
  padding: 16px 20px;
  border-radius: 12px;
  background: var(--bg-surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  border: 1px solid var(--border-color);
}

.toast__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-weight: bold;
  flex-shrink: 0;
}

.toast--success .toast__icon {
  background: #34c759;
  color: white;
}

.toast--error .toast__icon {
  background: #ff3b30;
  color: white;
}

.toast--info .toast__icon {
  background: #007aff;
  color: white;
}

.toast__message {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.toast__close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-secondary);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.toast__close:hover {
  background: rgba(0, 0, 0, 0.05);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
</style>
