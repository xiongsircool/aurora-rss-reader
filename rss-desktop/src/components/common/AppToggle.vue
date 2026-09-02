<script setup lang="ts">
defineProps<{
  disabled?: boolean
  size?: 'sm' | 'md'
}>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :disabled="disabled"
    @click="model = !model"
    class="relative shrink-0 rounded-full outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group"
    :class="[
      size === 'sm' ? 'w-9 h-5' : 'w-11 h-6',
      model
        ? 'bg-orange-500 shadow-[0_0_0_0px_rgba(249,115,22,0)] hover:shadow-[0_0_0_3px_rgba(249,115,22,0.2)]'
        : 'bg-[var(--border-color)] hover:bg-[var(--text-tertiary)]'
    ]"
  >
    <!-- thumb -->
    <span
      class="absolute top-0.5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-all duration-[280ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      :class="[
        size === 'sm'
          ? (model ? 'left-[18px] w-4 h-4' : 'left-0.5 w-4 h-4')
          : (model ? 'left-[22px] w-5 h-5' : 'left-0.5 w-5 h-5')
      ]"
    />
  </button>
</template>
