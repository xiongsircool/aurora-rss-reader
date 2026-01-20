<script setup lang="ts">
defineProps<{
  active: boolean
  direction: 'left' | 'right'
  title?: string
}>()

const emit = defineEmits<{
  (e: 'mousedown', event: MouseEvent): void
}>()

function handleMouseDown(event: MouseEvent) {
  emit('mousedown', event)
}
</script>

<template>
  <div
    class="resizer relative shrink-0 w-[3px] cursor-col-resize transition-all duration-200 bg-[rgba(15,17,21,0.1)] dark:bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,122,24,0.35)] dark:hover:bg-[rgba(255,122,24,0.4)] hover:shadow-[inset_0_0_0_1px_rgba(255,122,24,0.25)]"
    :class="[`resizer-${direction}`, { 'active bg-[rgba(255,122,24,0.55)]! dark:bg-[rgba(255,122,24,0.7)]! shadow-[inset_0_0_0_1px_rgba(255,122,24,0.35)]!': active }]"
    @mousedown="handleMouseDown"
    :title="title"
  ></div>
</template>

<style scoped>
/* Migrated to UnoCSS - only pseudo-elements remain */
.resizer::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 44px;
  background: rgba(255, 122, 24, 0);
  transition: background-color 0.2s, opacity 0.2s;
  border-radius: 2px;
}

.resizer:hover::before {
  background: rgba(255, 122, 24, 0.12);
}

.resizer.active::before {
  background: rgba(255, 122, 24, 0.22);
}

.resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 22px;
  border-radius: 1px;
  background: currentColor;
  opacity: 0.15;
  box-shadow: 0 -8px 0 currentColor, 0 8px 0 currentColor;
}

.resizer:hover::after,
.resizer.active::after {
  opacity: 0.35;
}
</style>
