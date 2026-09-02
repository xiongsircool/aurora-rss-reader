<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorBanner from '../components/common/ErrorBanner.vue'
import SourceAvatar from '../components/common/SourceAvatar.vue'
import { useSourceStore } from '../stores/sourceStore'
import { formatRelativeTime } from '../utils/date'

const sources = useSourceStore()
const url = ref('')
const groupName = ref('default')

async function addFeed() {
  const value = url.value.trim()
  if (!value) return
  await sources.createSource(value, groupName.value || 'default')
  url.value = ''
}

onMounted(() => {
  if (sources.sources.length === 0) void sources.loadSources()
})
</script>

<template>
  <main class="screen">
    <header class="screen-header">
      <div>
        <p class="eyebrow">Subscriptions</p>
        <h1>Sources</h1>
      </div>
      <button class="icon-button" type="button" aria-label="Sync sources" @click="sources.syncAll">
        <RefreshCw :size="20" :class="{ spinning: sources.syncing }" />
      </button>
    </header>

    <section class="stats-strip">
      <div>
        <strong>{{ sources.sources.length }}</strong>
        <span>sources</span>
      </div>
      <div>
        <strong>{{ sources.totalUnread }}</strong>
        <span>unread</span>
      </div>
      <div>
        <strong>{{ sources.groups.length }}</strong>
        <span>groups</span>
      </div>
    </section>

    <form class="add-source" @submit.prevent="addFeed">
      <label for="feed-url">Add feed</label>
      <div class="add-source__row">
        <input id="feed-url" v-model="url" type="url" inputmode="url" placeholder="Paste feed or site URL">
        <button class="primary-icon-button" type="submit" :disabled="sources.saving || !url.trim()" aria-label="Add feed">
          <Plus :size="18" />
        </button>
      </div>
      <input v-model="groupName" class="compact-input" type="text" placeholder="Group name">
    </form>

    <ErrorBanner :message="sources.error" />

    <section v-if="sources.loading" class="source-list">
      <div v-for="index in 4" :key="index" class="skeleton-card source-skeleton" />
    </section>

    <EmptyState
      v-else-if="sources.sources.length === 0"
      title="No sources"
      description="Paste a feed or site URL to let Aurora auto-detect the subscription."
    />

    <section v-else class="source-list">
      <article v-for="source in sources.sources" :key="source.id" class="source-row">
        <SourceAvatar :name="source.title || source.url" :favicon-url="source.favicon_url" :size="36" />
        <div class="source-row__body">
          <h2>{{ source.title || source.url }}</h2>
          <p>
            <span>{{ source.group_name }}</span>
            <span>{{ source.source_label }}</span>
            <span v-if="source.last_checked_at">Synced {{ formatRelativeTime(source.last_checked_at) }}</span>
          </p>
          <small v-if="source.last_error">{{ source.last_error }}</small>
        </div>
        <span v-if="source.unread_count" class="count-badge">{{ source.unread_count }}</span>
        <button class="icon-button source-row__remove" type="button" aria-label="Remove source" @click="sources.removeSource(source.id)">
          <Trash2 :size="16" />
        </button>
      </article>
    </section>
  </main>
</template>
