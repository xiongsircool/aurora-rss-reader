<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Feed } from '../../types'
import { useFeedIcons } from '../../composables/useFeedIcons'

interface FeedStat {
  id: string
  title: string
  count: number
}

interface GroupStat {
  total: number
  feeds: FeedStat[]
}

defineProps<{
  totalStarred: number
  groupedStats: Record<string, GroupStat>
  showFavoritesOnly: boolean
  selectedFavoriteFeed: string | null
  feedMap: Record<string, Feed>
}>()

const emit = defineEmits<{
  (e: 'toggle-favorites'): void
  (e: 'select-feed', feedId: string | null): void
}>()

const { t } = useI18n()
const { iconSrcFor, handleFeedIconLoad, handleFeedIconError, isFeedIconBroken, isFeedIconLoaded, getFeedColor, getFeedInitial } = useFeedIcons()
</script>

<template>
  <div class="my-4 border-y border-[var(--border-color)] py-3 dark:border-[rgba(255,255,255,0.08)]" v-if="totalStarred > 0">
    <div class="mb-2">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 bg-transparent border border-transparent rounded-lg text-left cursor-pointer transition-all duration-200 hover:bg-[rgba(255,122,24,0.1)] hover:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.2)] dark:hover:border-[rgba(255,122,24,0.4)]"
        :class="{ 'bg-[rgba(255,122,24,0.15)] border-[rgba(255,122,24,0.3)] c-[var(--accent)] dark:bg-[rgba(255,122,24,0.25)] dark:border-[rgba(255,122,24,0.5)]': showFavoritesOnly }"
        @click="emit('toggle-favorites')"
      >
        <span class="text-0 leading-none flex items-center" aria-hidden="true">
          <svg class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 3.5l2.7 5.61 6.3.92-4.55 4.44 1.08 6.28L12 17.77l-5.53 2.98 1.08-6.28L3 10.03l6.3-.92L12 3.5z"
            />
          </svg>
        </span>
        <span class="flex-1 font-semibold text-[15px] c-[var(--text-primary)] dark:c-[rgba(255,255,255,0.95)]">{{ t('groups.myFavorites') }}</span>
        <span class="text-xs bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-[10px] font-medium">{{ totalStarred }}</span>
      </button>
    </div>

    <!-- Favorites groups list -->
    <div v-show="showFavoritesOnly" class="ml-3">
      <!-- All Favorites -->
      <div class="mb-3 last:mb-0">
        <button
          class="w-full flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent rounded-md text-left cursor-pointer transition-all duration-200 text-sm c-inherit dark:c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.08)] hover:border-[rgba(255,122,24,0.15)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]"
          :class="{ 'bg-[rgba(255,122,24,0.15)] border-[rgba(255,122,24,0.3)] c-[var(--accent)]! dark:bg-[rgba(255,122,24,0.25)] dark:border-[rgba(255,122,24,0.5)]': !selectedFavoriteFeed }"
          @click="emit('select-feed', null)"
        >
          <span class="text-0 leading-none flex items-center op-80" aria-hidden="true">
            <svg class="w-4 h-4 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h6a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z" />
              <path d="M14 4h6v14a2 2 0 0 1-2 2h-4V6a2 2 0 0 0-2-2z" />
            </svg>
          </span>
          <span class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{{ t('navigation.allFavorites') }}</span>
          <span class="text-[11px] bg-[rgba(255,122,24,0.15)] c-[var(--accent)] px-[4px] py-[1px] rounded-md font-medium">{{ totalStarred }}</span>
        </button>
      </div>

      <!-- Grouped Favorites -->
      <template v-for="(group, groupName) in groupedStats" :key="groupName">
        <div class="mb-3 last:mb-0" v-if="groupName !== 'all' && group.total > 0">
          <div class="flex justify-between items-center px-2 py-1.5 text-xs c-[var(--text-secondary)] font-medium">
            <span class="uppercase tracking-[0.5px]">{{ groupName }}</span>
            <span class="bg-[rgba(255,122,24,0.2)] c-[var(--accent)] px-[5px] py-[1px] rounded-lg text-[11px]">{{ group.total }}</span>
          </div>

          <!-- Feeds in group -->
          <div class="ml-4">
            <button
              v-for="feed in group.feeds"
              :key="feed.id"
              class="w-full flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent rounded-md text-left cursor-pointer transition-all duration-200 text-sm c-inherit dark:c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.08)] hover:border-[rgba(255,122,24,0.15)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]"
              :class="{ 'bg-[rgba(255,122,24,0.15)] border-[rgba(255,122,24,0.3)] c-[var(--accent)]! dark:bg-[rgba(255,122,24,0.25)] dark:border-[rgba(255,122,24,0.5)]': selectedFavoriteFeed === feed.id }"
              @click="emit('select-feed', feed.id)"
            >
              <span
                class="w-[26px] h-[26px] rounded-lg overflow-hidden inline-flex items-center justify-center shrink-0 c-white font-semibold"
                :style="{ backgroundColor: getFeedColor(feed.id) }"
                aria-hidden="true"
              >
                <img
                  v-show="!isFeedIconBroken(feedMap[feed.id]) && isFeedIconLoaded(iconSrcFor(feedMap[feed.id]?.favicon_url))"
                  :src="iconSrcFor(feedMap[feed.id]?.favicon_url) || undefined"
                  :alt="`${feed.title} 图标`"
                  loading="lazy"
                  decoding="async"
                  @load="handleFeedIconLoad(feed.id, iconSrcFor(feedMap[feed.id]?.favicon_url))"
                  @error="handleFeedIconError(feed.id, iconSrcFor(feedMap[feed.id]?.favicon_url))"
                  class="w-full h-full object-contain bg-[rgba(255,255,255,0.8)] rounded-md block p-0.5"
                />
                <span class="text-[0.7rem] uppercase" v-show="isFeedIconBroken(feedMap[feed.id]) || !isFeedIconLoaded(iconSrcFor(feedMap[feed.id]?.favicon_url))">
                  {{ getFeedInitial(feed.title) }}
                </span>
              </span>
              <span class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{{ feed.title }}</span>
              <span class="text-[11px] bg-[rgba(255,122,24,0.15)] c-[var(--accent)] px-[4px] py-[1px] rounded-md font-medium">{{ feed.count }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
