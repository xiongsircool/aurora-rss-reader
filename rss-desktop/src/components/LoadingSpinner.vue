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
  gap: 12px;
  padding: 24px;
}

.spinner {
  border: 3px solid rgba(255, 122, 24, 0.2);
  border-top-color: #ff7a18;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner--small {
  width: 20px;
  height: 20px;
  border-width: 2px;
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

.spinner-message {
  color: var(--text-secondary);
  font-size: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

