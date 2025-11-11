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
    aria-label="RSS READER 图标"
  >
    <defs>
      <linearGradient id="rss-mark-gradient" x1="12" y1="10" x2="56" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#ff7a18" />
        <stop offset="55%" stop-color="#ffb347" />
        <stop offset="100%" stop-color="#ffd262" />
      </linearGradient>
    </defs>
    <rect
      x="8"
      y="10"
      width="48"
      height="44"
      rx="10"
      fill="url(#rss-mark-gradient)"
      opacity="0.12"
    />
    <path
      d="M20 18h12c3 0 4 2 4 4v24c0 2-1 4-4 4H20c-3 0-4-2-4-4V22c0-2 1-4 4-4z"
      fill="#fff"
      opacity="0.2"
    />
    <path
      d="M32 18h12c3 0 6 3 6 6v22c0 3-3 6-6 6H32"
      stroke="url(#rss-mark-gradient)"
      stroke-width="3"
      stroke-linecap="round"
    />
    <line
      x1="32"
      y1="18"
      x2="32"
      y2="52"
      stroke="url(#rss-mark-gradient)"
      stroke-width="2"
      stroke-linecap="round"
      opacity="0.6"
    />
    <path
      d="M26 36c4 0 8 4 8 8"
      stroke="url(#rss-mark-gradient)"
      stroke-width="3"
      stroke-linecap="round"
    />
    <path
      d="M26 28c8 0 16 7 16 16"
      stroke="url(#rss-mark-gradient)"
      stroke-width="3"
      stroke-linecap="round"
      opacity="0.8"
    />
    <circle cx="22" cy="44" r="3.5" fill="url(#rss-mark-gradient)" />
  </svg>
</template>
