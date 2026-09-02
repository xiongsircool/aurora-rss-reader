<script setup lang="ts">
import { onMounted, watch } from 'vue'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorBanner from '../components/common/ErrorBanner.vue'
import InboxEntryCard from '../components/inbox/InboxEntryCard.vue'
import { useInboxStore } from '../stores/inboxStore'

const inbox = useInboxStore()

onMounted(() => {
  void inbox.setFilter('saved')
})

watch(
  () => inbox.filter,
  (filter) => {
    if (filter !== 'saved') void inbox.setFilter('saved')
  },
)
</script>

<template>
  <main class="screen">
    <header class="screen-header">
      <div>
        <p class="eyebrow">Later</p>
        <h1>Saved</h1>
      </div>
    </header>

    <ErrorBanner :message="inbox.error" />

    <section v-if="inbox.loading" class="entry-list">
      <div v-for="index in 4" :key="index" class="skeleton-card" />
    </section>

    <EmptyState
      v-else-if="inbox.entries.length === 0"
      title="Nothing saved"
      description="Saved entries appear here for later reading."
    />

    <section v-else class="entry-list">
      <InboxEntryCard
        v-for="entry in inbox.entries"
        :key="entry.id"
        :entry="entry"
        @toggle-saved="inbox.toggleSaved"
      />
    </section>
  </main>
</template>
