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
    class="resizer"
    :class="[`resizer-${direction}`, { active }]"
    @mousedown="handleMouseDown"
    :title="title"
  ></div>
</template>

<style scoped>
.resizer {
  width: 3px;
  background: rgba(15, 17, 21, 0.1);
  cursor: col-resize;
  transition: background-color 0.2s, box-shadow 0.2s;
  position: relative;
  flex-shrink: 0;
}

.resizer:hover {
  background: rgba(255, 122, 24, 0.35);
  box-shadow: inset 0 0 0 1px rgba(255, 122, 24, 0.25);
}

.resizer.active {
  background: rgba(255, 122, 24, 0.55);
  box-shadow: inset 0 0 0 1px rgba(255, 122, 24, 0.35);
}

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

:global(.dark) .resizer {
  background: rgba(255, 255, 255, 0.1);
}

:global(.dark) .resizer:hover {
  background: rgba(255, 122, 24, 0.4);
}

:global(.dark) .resizer.active {
  background: rgba(255, 122, 24, 0.7);
}
</style>
