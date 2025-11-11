<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: number }>(), {
  size: 32,
})
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 64 64"
    fill="none"
    role="img"
    aria-label="Aurora Feeds 图标"
  >
    <defs>
      <linearGradient id="rss-mark-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1A2A6C" />
        <stop offset="55%" stop-color="#4BB4F8" />
        <stop offset="100%" stop-color="#8EF6E4" />
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="14" fill="#050A15" />
    <g stroke="url(#rss-mark-gradient)" fill="none" stroke-linecap="round">
      <path
        d="M10 40 C16 28, 22 16, 32 22 C42 28, 48 16, 54 8"
        stroke-width="5"
      />
      <path
        d="M14 50 C20 40, 28 34, 36 38 C44 42, 50 32, 54 26"
        stroke-width="3.5"
        opacity="0.85"
      />
    </g>
    <circle cx="22" cy="18" r="3.5" fill="#8EF6E4" opacity="0.9" />
  </svg>
</template>
