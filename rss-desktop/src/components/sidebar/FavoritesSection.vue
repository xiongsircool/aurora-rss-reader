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
  <div class="favorites-section" v-if="totalStarred > 0">
    <div class="favorites-header">
      <button
        :class="['favorites-toggle', { active: showFavoritesOnly }]"
        @click="emit('toggle-favorites')"
      >
        <span class="favorites-icon" aria-hidden="true">
          <svg class="icon icon-18" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 3.5l2.7 5.61 6.3.92-4.55 4.44 1.08 6.28L12 17.77l-5.53 2.98 1.08-6.28L3 10.03l6.3-.92L12 3.5z"
            />
          </svg>
        </span>
        <span class="favorites-title">{{ t('groups.myFavorites') }}</span>
        <span class="favorites-count">{{ totalStarred }}</span>
      </button>
    </div>

    <!-- Favorites groups list -->
    <div v-show="showFavoritesOnly" class="favorites-list">
      <!-- All Favorites -->
      <div class="favorites-group">
        <button
          :class="['favorites-item', { active: !selectedFavoriteFeed }]"
          @click="emit('select-feed', null)"
        >
          <span class="favorites-item-icon" aria-hidden="true">
            <svg class="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h6a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z" />
              <path d="M14 4h6v14a2 2 0 0 1-2 2h-4V6a2 2 0 0 0-2-2z" />
            </svg>
          </span>
          <span class="favorites-item-title">{{ t('navigation.allFavorites') }}</span>
          <span class="favorites-item-count">{{ totalStarred }}</span>
        </button>
      </div>

      <!-- Grouped Favorites -->
      <template v-for="(group, groupName) in groupedStats" :key="groupName">
        <div class="favorites-group" v-if="groupName !== 'all' && group.total > 0">
          <div class="favorites-group-header">
            <span class="favorites-group-name">{{ groupName }}</span>
            <span class="favorites-group-count">{{ group.total }}</span>
          </div>

          <!-- Feeds in group -->
          <div class="favorites-group-feeds">
            <button
              v-for="feed in group.feeds"
              :key="feed.id"
              :class="['favorites-feed-item', { active: selectedFavoriteFeed === feed.id }]"
              @click="emit('select-feed', feed.id)"
            >
              <span
                class="favorites-feed-icon feed-icon"
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
                />
                <span class="feed-icon__initial" v-show="isFeedIconBroken(feedMap[feed.id]) || !isFeedIconLoaded(iconSrcFor(feedMap[feed.id]?.favicon_url))">
                  {{ getFeedInitial(feed.title) }}
                </span>
              </span>
              <span class="favorites-feed-title">{{ feed.title }}</span>
              <span class="favorites-feed-count">{{ feed.count }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.favorites-section {
  margin: 16px 0;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 0;
}

.favorites-header {
  margin-bottom: 8px;
}

.favorites-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.favorites-toggle:hover {
  background: rgba(255, 122, 24, 0.1);
  border-color: rgba(255, 122, 24, 0.2);
}

.favorites-toggle.active {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
  color: var(--accent);
}

.favorites-icon {
  font-size: 0;
  line-height: 0;
  display: flex;
  align-items: center;
}

.icon {
  width: 16px;
  height: 16px;
  display: block;
}

.icon-16 { width: 16px; height: 16px; }
.icon-18 { width: 18px; height: 18px; }

.favorites-title {
  flex: 1;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.favorites-count {
  font-size: 12px;
  background: var(--accent);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.favorites-list {
  margin-left: 12px;
}

.favorites-group {
  margin-bottom: 12px;
}

.favorites-group:last-child {
  margin-bottom: 0;
}

.favorites-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.favorites-group-name {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.favorites-group-count {
  background: rgba(255, 122, 24, 0.2);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 11px;
}

.favorites-item,
.favorites-feed-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.favorites-item:hover,
.favorites-feed-item:hover {
  background: rgba(255, 122, 24, 0.08);
  border-color: rgba(255, 122, 24, 0.15);
}

.favorites-item.active,
.favorites-feed-item.active {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
  color: var(--accent);
}

.favorites-item-icon {
  font-size: 0;
  line-height: 0;
  display: flex;
  align-items: center;
  opacity: 0.8;
}

.favorites-feed-icon {
  --feed-icon-size: 26px;
  opacity: 1;
}

.feed-icon {
  width: var(--feed-icon-size, 26px);
  height: var(--feed-icon-size, 26px);
  border-radius: 8px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-weight: 600;
}

.feed-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
}

.feed-icon__initial {
  font-size: 0.7rem;
  text-transform: uppercase;
}

.favorites-item-title,
.favorites-feed-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorites-item-count,
.favorites-feed-count {
  font-size: 11px;
  background: rgba(255, 122, 24, 0.15);
  color: var(--accent);
  padding: 1px 4px;
  border-radius: 6px;
  font-weight: 500;
}

.favorites-group-feeds {
  margin-left: 16px;
}

:global(.dark) .favorites-section {
  border-color: rgba(255, 255, 255, 0.08);
}

:global(.dark) .favorites-title {
  color: rgba(255, 255, 255, 0.95);
}

:global(.dark) .favorites-toggle:hover {
  background: rgba(255, 122, 24, 0.2);
  border-color: rgba(255, 122, 24, 0.4);
}

:global(.dark) .favorites-toggle.active {
  background: rgba(255, 122, 24, 0.25);
  border-color: rgba(255, 122, 24, 0.5);
}

:global(.dark) .favorites-item,
:global(.dark) .favorites-feed-item {
  color: var(--text-primary);
}

:global(.dark) .favorites-item:hover,
:global(.dark) .favorites-feed-item:hover {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
}

:global(.dark) .favorites-item.active,
:global(.dark) .favorites-feed-item.active {
  background: rgba(255, 122, 24, 0.25);
  border-color: rgba(255, 122, 24, 0.5);
}
</style>
