<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
  message?: string
}>()
</script>

<template>
  <div class="spinner-container">
    <div :class="['spinner', `spinner--${size || 'medium'}`]"></div>
    <p v-if="message" class="spinner-message">{{ message }}</p>
  </div>
</template>

<style scoped>
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--au-space-3);
  padding: var(--au-space-6);
}

.spinner {
  border: 3px solid hsl(var(--au-accent-primary) / 0.2);
  border-top-color: hsl(var(--au-accent-primary));
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  position: relative;
}

/* 添加渐变效果 */
.spinner::before {
  content: '';
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 3px solid transparent;
  border-top-color: hsl(var(--au-accent-primary) / 0.1);
  border-radius: 50%;
  animation: spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse;
}

.spinner--small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.spinner--small::before {
  border-width: 2px;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
}

.spinner--medium {
  width: 40px;
  height: 40px;
  border-width: 3px;
}

.spinner--large {
  width: 60px;
  height: 60px;
  border-width: 4px;
}

.spinner--large::before {
  border-width: 4px;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
}

.spinner-message {
  color: hsl(var(--au-text-secondary));
  font-size: var(--au-text-sm);
  font-weight: 500;
  margin: 0;
  text-align: center;
  animation: fadeIn 0.3s var(--au-transition-normal);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 暗色模式适配 */
:root.dark .spinner {
  filter: brightness(1.1);
}

:root.dark .spinner::before {
  filter: brightness(1.2);
}
</style>

