<script setup lang="ts">
import type { ContextMenuPosition } from '../../composables/useContextMenu'

defineProps<{
  show: boolean
  position: ContextMenuPosition
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="context-menu fixed z-[9999] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] py-1.5 min-w-[200px]"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
    >
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
/* Animation handled by parent */
</style>
