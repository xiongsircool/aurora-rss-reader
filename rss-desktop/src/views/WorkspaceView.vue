<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTheme } from '../composables/useTheme'
import { useNotification } from '../composables/useNotification'
import { useCollectionsStore, type CollectionEntry } from '../stores/collectionsStore'
import { type SearchResult } from '../stores/searchStore'
import { useTagsStore, type TagEntry } from '../stores/tagsStore'
import WorkspaceHeader from '../components/workspace/WorkspaceHeader.vue'
import WorkspaceNav from '../components/workspace/WorkspaceNav.vue'
import CollectionList from '../components/collections/CollectionList.vue'
import CollectionDetail from '../components/collections/CollectionDetail.vue'
import EntryDetailView from '../components/collections/EntryDetailView.vue'
import SearchView from '../components/search/SearchView.vue'
import TagList from '../components/tags/TagList.vue'
import TagEntryList from '../components/tags/TagEntryList.vue'
import Toast from '../components/Toast.vue'

const router = useRouter()
const { t } = useI18n()
const { darkMode, toggleTheme } = useTheme()
const { showToast, toastMessage, toastType, showNotification } = useNotification()
const collectionsStore = useCollectionsStore()
const tagsStore = useTagsStore()

const activeModule = ref('collections')
const navCollapsed = ref(false)
const NAV_COLLAPSE_KEY = 'workspace.navCollapsed'
const selectedEntry = ref<CollectionEntry | null>(null)
const selectedSearchResult = ref<SearchResult | null>(null)
const selectedTagEntry = ref<TagEntry | null>(null)

function goBack() {
  router.push('/')
}

function handleSelectEntry(entry: CollectionEntry) {
  selectedEntry.value = entry
}

function handleCloseDetail() {
  selectedEntry.value = null
}

function handleOpenExternal() {
  if (selectedEntry.value?.url) {
    window.open(selectedEntry.value.url, '_blank')
  }
}

async function handleRemoveEntry() {
  if (!selectedEntry.value || !collectionsStore.activeCollectionId) return
  await collectionsStore.removeEntryFromCollection(
    collectionsStore.activeCollectionId,
    selectedEntry.value.id
  )
  selectedEntry.value = null
  showNotification(t('collections.removeSuccess'), 'success')
}

function handleEntryRemoved(entryId: string) {
  if (selectedEntry.value?.id === entryId) {
    selectedEntry.value = null
  }
}

function handleSelectSearchResult(result: SearchResult) {
  selectedSearchResult.value = result
}

function handleCloseSearchDetail() {
  selectedSearchResult.value = null
}

function handleOpenSearchExternal() {
  if (selectedSearchResult.value?.url) {
    window.open(selectedSearchResult.value.url, '_blank')
  }
}

function handleSelectTagEntry(entry: TagEntry) {
  selectedTagEntry.value = entry
}

function handleCloseTagDetail() {
  selectedTagEntry.value = null
}

function handleOpenTagExternal() {
  if (selectedTagEntry.value?.url) {
    window.open(selectedTagEntry.value.url, '_blank')
  }
}

// Clear selected tag entry when view/tag changes
watch(() => [tagsStore.selectedTagId, tagsStore.selectedView], () => {
  selectedTagEntry.value = null
})

onMounted(async () => {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(NAV_COLLAPSE_KEY)
    navCollapsed.value = saved === '1'
  }
  await collectionsStore.fetchCollections()
})

// 切换书签组时清空选中的文章
watch(() => collectionsStore.activeCollectionId, () => {
  selectedEntry.value = null
})

watch(navCollapsed, (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(NAV_COLLAPSE_KEY, value ? '1' : '0')
})
</script>

<template>
  <Toast :show="showToast" :message="toastMessage" :type="toastType" />
  <div class="workspace-shell min-h-screen bg-[var(--bg-base)] c-[var(--text-primary)]">
    <WorkspaceHeader
      :dark-mode="darkMode"
      @toggle-theme="toggleTheme"
      @go-back="goBack"
    />

    <div class="flex h-[calc(100vh-60px)]">
      <WorkspaceNav
        :active-module="activeModule"
        :collapsed="navCollapsed"
        @select="activeModule = $event"
        @toggle-collapse="navCollapsed = !navCollapsed"
      />

      <main class="flex-1 overflow-hidden">
        <!-- Collections Module -->
        <div v-if="activeModule === 'collections'" class="h-full flex">
          <CollectionList class="w-[280px] shrink-0" />
          <CollectionDetail
            class="flex-1 min-w-[300px]"
            :selected-entry-id="selectedEntry?.id || null"
            @select-entry="handleSelectEntry"
            @entry-removed="handleEntryRemoved"
          />
          <EntryDetailView
            v-if="selectedEntry"
            class="w-[450px] shrink-0"
            :entry="selectedEntry"
            @close="handleCloseDetail"
            @open-external="handleOpenExternal"
            @remove="handleRemoveEntry"
          />
        </div>

        <!-- Placeholder for future modules -->
        <div v-else-if="activeModule === 'search'" class="h-full flex">
          <SearchView
            class="flex-1 min-w-[400px]"
            :selected-result-id="selectedSearchResult?.id || null"
            @select-result="handleSelectSearchResult"
          />
          <EntryDetailView
            v-if="selectedSearchResult"
            class="w-[450px] shrink-0"
            :entry="selectedSearchResult"
            :show-remove="false"
            @close="handleCloseSearchDetail"
            @open-external="handleOpenSearchExternal"
          />
        </div>

        <!-- Tags Module -->
        <div v-else-if="activeModule === 'tags'" class="h-full flex">
          <TagList class="w-[280px] shrink-0" />
          <TagEntryList
            class="flex-1 min-w-[300px]"
            :selected-entry-id="selectedTagEntry?.id || null"
            @select-entry="handleSelectTagEntry"
          />
          <EntryDetailView
            v-if="selectedTagEntry"
            class="w-[450px] shrink-0"
            :entry="selectedTagEntry"
            :show-remove="false"
            @close="handleCloseTagDetail"
            @open-external="handleOpenTagExternal"
          />
        </div>

        <!-- Placeholder for other modules -->
        <div v-else class="h-full flex items-center justify-center c-[var(--text-secondary)]">
          <p>{{ t('common.noData') }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.workspace-shell {
  display: flex;
  flex-direction: column;
}
</style>
