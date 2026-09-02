<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RefreshCw, Search } from 'lucide-vue-next'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorBanner from '../components/common/ErrorBanner.vue'
import InboxEntryCard from '../components/inbox/InboxEntryCard.vue'
import { useInboxStore } from '../stores/inboxStore'
import { useSourceStore } from '../stores/sourceStore'
import type { InboxFilter } from '../types'

const inbox = useInboxStore()
const sources = useSourceStore()

const filters: Array<{ value: InboxFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'saved', label: 'Saved' },
]

const visibleGroups = computed(() => (
  sources.groups
    .filter((group) => group.name && group.name !== 'default')
    .sort((a, b) => b.unread_count - a.unread_count)
    .slice(0, 5)
))

onMounted(() => {
  if (inbox.entries.length === 0) void inbox.loadEntries()
  if (sources.sources.length === 0) void sources.loadSources()
})
</script>

<template>
  <main class="screen">
    <header class="screen-header">
      <div>
        <p class="eyebrow">Aurora</p>
        <h1>Inbox</h1>
      </div>
      <div class="header-actions">
        <button class="icon-button" type="button" aria-label="Search">
          <Search :size="20" />
        </button>
        <button class="icon-button" type="button" aria-label="Sync" @click="inbox.refreshFeeds">
          <RefreshCw :size="20" :class="{ spinning: inbox.syncing }" />
        </button>
      </div>
    </header>

    <div class="segmented">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        :class="{ active: inbox.filter === item.value }"
        @click="inbox.setFilter(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="chip-row" aria-label="Groups">
      <button type="button" class="chip" :class="{ active: inbox.activeGroupName === null }" @click="inbox.setGroup(null)">
        All sources
      </button>
      <button
        v-for="group in visibleGroups"
        :key="group.name"
        type="button"
        class="chip"
        :class="{ active: inbox.activeGroupName === group.name }"
        @click="inbox.setGroup(group.name)"
      >
        {{ group.name }}
        <span v-if="group.unread_count">{{ group.unread_count }}</span>
      </button>
    </div>

    <ErrorBanner :message="inbox.error" />

    <section v-if="inbox.loading" class="entry-list" aria-busy="true">
      <div v-for="index in 5" :key="index" class="skeleton-card" />
    </section>

    <EmptyState
      v-else-if="inbox.entries.length === 0"
      title="No entries yet"
      description="Add a source or sync your feeds to fill the inbox."
    />

    <section v-else class="entry-list">
      <InboxEntryCard
        v-for="entry in inbox.entries"
        :key="entry.id"
        :entry="entry"
        @toggle-saved="inbox.toggleSaved"
      />
      <button v-if="inbox.hasMore" class="load-more" type="button" :disabled="inbox.loadingMore" @click="inbox.loadEntries({ append: true })">
        {{ inbox.loadingMore ? 'Loading...' : 'Load more' }}
      </button>
    </section>
  </main>
</template>
