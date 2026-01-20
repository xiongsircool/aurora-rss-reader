<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: number }>(), {
  size: 32,
})
const logoSrc = new URL('/icons/glow-no-bg.png', import.meta.url).href
</script>

<template>
  <img
    class="block object-contain"
    :src="logoSrc"
    :width="props.size"
    :height="props.size"
    alt="Aurora Feeds 图标"
  />
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
