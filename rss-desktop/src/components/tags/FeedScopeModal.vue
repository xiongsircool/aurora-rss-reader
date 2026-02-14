<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore } from '../../stores/feedStore'
import type { Feed } from '../../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const feedStore = useFeedStore()

const searchQuery = ref('')
const updating = ref(false)
const expandedGroups = ref<Set<string>>(new Set())

// 按分组组织订阅源
const groupedFeeds = computed(() => {
  const groups = new Map<string, Feed[]>()

  for (const feed of feedStore.feeds) {
    const groupName = feed.group_name || t('tags.ungrouped')
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }
    groups.get(groupName)!.push(feed)
  }

  // 转换为数组并排序
  return Array.from(groups.entries())
    .map(([name, feeds]) => ({ name, feeds }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// 过滤后的分组
const filteredGroups = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return groupedFeeds.value

  return groupedFeeds.value
    .map(group => ({
      name: group.name,
      feeds: group.feeds.filter(feed => {
        const label = (feed.custom_title || feed.title || feed.url || '').toLowerCase()
        return label.includes(keyword) || group.name.toLowerCase().includes(keyword)
      })
    }))
    .filter(group => group.feeds.length > 0)
})

// 统计数据
const stats = computed(() => {
  const total = feedStore.feeds.length
  const enabled = feedStore.feeds.filter(f => f.ai_tagging_enabled !== 0).length
  return { total, enabled }
})

// 检查订阅源是否启用
function isFeedEnabled(feed: Feed) {
  return feed.ai_tagging_enabled !== 0
}

// 检查分组是否全部启用
function isGroupAllEnabled(feeds: Feed[]) {
  return feeds.length > 0 && feeds.every(f => isFeedEnabled(f))
}

// 检查分组是否部分启用
function isGroupPartialEnabled(feeds: Feed[]) {
  const enabledCount = feeds.filter(f => isFeedEnabled(f)).length
  return enabledCount > 0 && enabledCount < feeds.length
}

// 获取分组启用数量
function getGroupEnabledCount(feeds: Feed[]) {
  return feeds.filter(f => isFeedEnabled(f)).length
}

// 切换分组展开状态
function toggleGroup(groupName: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(groupName)) {
    next.delete(groupName)
  } else {
    next.add(groupName)
  }
  expandedGroups.value = next
}

// 展开所有分组
function expandAll() {
  expandedGroups.value = new Set(groupedFeeds.value.map(g => g.name))
}

// 收起所有分组
function collapseAll() {
  expandedGroups.value = new Set()
}

// 切换单个订阅源
async function toggleFeed(feed: Feed) {
  updating.value = true
  try {
    await feedStore.updateFeedTagging(feed.id, !isFeedEnabled(feed))
  } finally {
    updating.value = false
  }
}

// 切换整个分组
async function toggleGroup_tagging(feeds: Feed[]) {
  const allEnabled = isGroupAllEnabled(feeds)
  const targetIds = feeds
    .filter(f => isFeedEnabled(f) === allEnabled)
    .map(f => f.id)

  if (targetIds.length === 0) return

  updating.value = true
  try {
    await feedStore.bulkUpdateFeedTagging(targetIds, !allEnabled)
  } finally {
    updating.value = false
  }
}

// 全部启用
async function enableAll() {
  const targetIds = feedStore.feeds
    .filter(f => !isFeedEnabled(f))
    .map(f => f.id)

  if (targetIds.length === 0) return

  updating.value = true
  try {
    await feedStore.bulkUpdateFeedTagging(targetIds, true)
  } finally {
    updating.value = false
  }
}

// 全部禁用
async function disableAll() {
  const targetIds = feedStore.feeds
    .filter(f => isFeedEnabled(f))
    .map(f => f.id)

  if (targetIds.length === 0) return

  updating.value = true
  try {
    await feedStore.bulkUpdateFeedTagging(targetIds, false)
  } finally {
    updating.value = false
  }
}

// 打开时默认展开所有分组
watch(() => props.visible, (visible) => {
  if (visible) {
    expandAll()
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-[var(--bg-surface)] rounded-xl shadow-xl w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="p-4 border-b border-[var(--border-color)] shrink-0">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-[15px] font-semibold">{{ t('tags.feedScopeTitle') }}</h3>
            <button
              @click="emit('close')"
              class="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <p class="text-[12px] c-[var(--text-secondary)]">{{ t('tags.feedScopeDesc') }}</p>
        </div>

        <!-- Toolbar -->
        <div class="px-4 py-3 border-b border-[var(--border-color)] shrink-0 space-y-3">
          <!-- Stats & Bulk Actions -->
          <div class="flex items-center justify-between">
            <span class="text-[13px] c-[var(--text-secondary)]">
              {{ t('tags.taggingEnabledCount', { enabled: stats.enabled, total: stats.total }) }}
            </span>
            <div class="flex gap-2">
              <button
                @click="enableAll"
                :disabled="updating || stats.enabled === stats.total"
                class="px-3 py-1.5 rounded-md text-[12px] font-medium border border-[var(--border-color)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ t('tags.enableAll') }}
              </button>
              <button
                @click="disableAll"
                :disabled="updating || stats.enabled === 0"
                class="px-3 py-1.5 rounded-md text-[12px] font-medium border border-[var(--border-color)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ t('tags.disableAll') }}
              </button>
            </div>
          </div>

          <!-- Search & Expand/Collapse -->
          <div class="flex items-center gap-2">
            <div class="flex-1 relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                class="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)]"
                :placeholder="t('tags.searchFeeds')"
              />
            </div>
            <button
              @click="expandAll"
              class="px-2.5 py-2 rounded-md text-[12px] border border-[var(--border-color)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
              :title="t('tags.expandAll')"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 10l5 5 5-5"/>
              </svg>
            </button>
            <button
              @click="collapseAll"
              class="px-2.5 py-2 rounded-md text-[12px] border border-[var(--border-color)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
              :title="t('tags.collapseAll')"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 14l-5-5-5 5"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Feed List -->
        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="filteredGroups.length === 0" class="py-8 text-center c-[var(--text-tertiary)] text-[13px]">
            {{ t('tags.noFeedsMatch') }}
          </div>

          <div v-for="group in filteredGroups" :key="group.name" class="mb-1">
            <!-- Group Header -->
            <div
              class="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
              @click="toggleGroup(group.name)"
            >
              <svg
                class="w-4 h-4 c-[var(--text-tertiary)] transition-transform"
                :class="expandedGroups.has(group.name) ? 'rotate-90' : ''"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6"/>
              </svg>

              <!-- Group Checkbox -->
              <input
                type="checkbox"
                :checked="isGroupAllEnabled(group.feeds)"
                :indeterminate="isGroupPartialEnabled(group.feeds)"
                :disabled="updating"
                @click.stop
                @change="toggleGroup_tagging(group.feeds)"
                class="w-4 h-4 rounded cursor-pointer"
              />

              <span class="flex-1 text-[13px] font-medium truncate">{{ group.name }}</span>
              <span class="text-[11px] c-[var(--text-tertiary)]">
                {{ getGroupEnabledCount(group.feeds) }}/{{ group.feeds.length }}
              </span>
            </div>

            <!-- Feed Items -->
            <div
              v-if="expandedGroups.has(group.name)"
              class="ml-6 border-l border-[var(--border-color)]"
            >
              <label
                v-for="feed in group.feeds"
                :key="feed.id"
                class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)]"
              >
                <input
                  type="checkbox"
                  :checked="isFeedEnabled(feed)"
                  :disabled="updating"
                  @change="toggleFeed(feed)"
                  class="w-4 h-4 rounded cursor-pointer"
                />
                <img
                  v-if="feed.favicon_url"
                  :src="feed.favicon_url"
                  class="w-4 h-4 rounded shrink-0"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span class="flex-1 text-[13px] truncate">
                  {{ feed.custom_title || feed.title || feed.url }}
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-[var(--border-color)] shrink-0 flex justify-end">
          <button
            @click="emit('close')"
            class="px-4 py-2 rounded-lg text-[13px] bg-[var(--accent)] c-white hover:opacity-90"
          >
            {{ t('common.done') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
