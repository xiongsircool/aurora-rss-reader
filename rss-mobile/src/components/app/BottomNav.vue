<script setup lang="ts">
import { Bookmark, Inbox, Rss, Settings } from 'lucide-vue-next'

const tabs = [
  { to: '/', label: 'Inbox', icon: Inbox },
  { to: '/sources', label: 'Sources', icon: Rss },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: Settings },
]
</script>

<template>
  <nav class="bottom-nav" aria-label="Primary">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="bottom-nav__item"
      active-class="bottom-nav__item--active"
      :aria-label="tab.label"
    >
      <component :is="tab.icon" :size="20" stroke-width="2.2" />
      <span>{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>
