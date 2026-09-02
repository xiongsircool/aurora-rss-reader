<script setup lang="ts">
defineProps<{
  message: string | null
}>()
</script>

<template>
  <div v-if="message" class="error-banner" role="alert">
    {{ message }}
  </div>
</template>
