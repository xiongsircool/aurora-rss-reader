<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
  message?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 p-6">
    <div
      class="animate-spin rounded-full border-solid border-[rgba(255,122,24,0.2)] border-t-[#ff7a18]"
      :class="{
        'w-5 h-5 border-2': size === 'small',
        'w-10 h-10 border-3': !size || size === 'medium',
        'w-15 h-15 border-4': size === 'large',
      }"
    ></div>
    <p v-if="message" class="text-sm c-[var(--text-secondary)]">{{ message }}</p>
  </div>
</template>

<style scoped>
/* Scoped styles removed in favor of UnoCSS utility classes */
</style>

