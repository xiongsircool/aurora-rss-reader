<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Feed } from '../../types'
import { useFeedIcons } from '../../composables/useFeedIcons'

defineProps<{
  feed: Feed
  active: boolean
  isEditing: boolean
  editingGroupName: string
  isDateFilterActive: boolean
  timeFilterLabel: string
}>()

const emit = defineEmits<{
  (e: 'select', feedId: string): void
  (e: 'start-edit', feedId: string, groupName: string): void
  (e: 'save-edit', feedId: string, groupName: string): void
  (e: 'cancel-edit'): void
  (e: 'delete', feedId: string): void
  (e: 'update:editingGroupName', value: string): void
  (e: 'mark-feed-read', feedId: string): void
}>()

const { t } = useI18n()

const { iconSrcFor, handleFeedIconLoad, handleFeedIconError, isFeedIconBroken, isFeedIconLoaded, getFeedColor, getFeedInitial } = useFeedIcons()

function formatLastChecked(date?: string | null) {
  if (!date) return '未刷新'
  // Import dayjs would be needed here, for now return simple format
  return '已刷新'
}

function getFeedRefreshStatus(_feed: Feed): 'ok' | 'due' | 'never' {
  if (!_feed.last_checked_at) return 'never'
  return 'ok'
}

function getFeedRefreshTooltip(_feed: Feed): string {
  return '刷新状态'
}
</script>

<template>
  <div :class="['feed-item-wrapper', { active }]">
    <button class="feed-item-main" @click="emit('select', feed.id)">
      <div
        class="feed-item__icon feed-icon"
        :style="{ backgroundColor: getFeedColor(feed.id) }"
        aria-hidden="true"
      >
        <img
          v-show="!isFeedIconBroken(feed) && isFeedIconLoaded(iconSrcFor(feed?.favicon_url))"
          :src="iconSrcFor(feed.favicon_url) || undefined"
          :alt="`${feed.title || feed.url} 图标`"
          loading="lazy"
          decoding="async"
          @load="handleFeedIconLoad(feed.id, iconSrcFor(feed.favicon_url))"
          @error="handleFeedIconError(feed.id, iconSrcFor(feed.favicon_url))"
        />
        <span 
          class="feed-icon__initial" 
          v-show="isFeedIconBroken(feed) || !isFeedIconLoaded(iconSrcFor(feed?.favicon_url))"
        >
          {{ getFeedInitial(feed.title || feed.url) }}
        </span>
      </div>
      <div class="feed-item__info">
        <span class="feed-item__title">{{ feed.title || feed.url }}</span>
        <span class="feed-item__url" v-if="!isEditing">{{ feed.url }}</span>
        <div class="feed-item__meta" v-if="!isEditing">
          <span class="last-checked" :title="getFeedRefreshTooltip(feed)">
            <span class="status-dot" :class="getFeedRefreshStatus(feed)"></span>
            {{ formatLastChecked(feed.last_checked_at) }}
          </span>
        </div>
        <div v-else class="feed-item__edit">
          <input
            :value="editingGroupName"
            @input="emit('update:editingGroupName', ($event.target as HTMLInputElement).value)"
            @click.stop
            placeholder="分组名称"
            class="group-input"
          />
        </div>
      </div>
      <span
        class="feed-item__badge"
        v-if="feed.unread_count"
        :title="isDateFilterActive ? `仅统计${timeFilterLabel}内的未读文章` : '全部未读文章'"
      >
        {{ feed.unread_count }}
      </span>
    </button>
    <div class="feed-item__actions" @click.stop>
      <!-- Mark as Read Button -->
      <button
        v-if="!isEditing && feed.unread_count"
        @click="emit('mark-feed-read', feed.id)"
        class="action-btn mark-read"
        :title="t('articles.markFeedAsRead')"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      </button>
      <button
        v-if="isEditing"
        @click="emit('save-edit', feed.id, editingGroupName)"
        class="action-btn save"
        title="保存"
      >
        ✓
      </button>
      <button
        v-if="isEditing"
        @click="emit('cancel-edit')"
        class="action-btn cancel"
        title="取消"
      >
        ✕
      </button>
      <button
        v-if="!isEditing"
        @click="emit('start-edit', feed.id, feed.group_name)"
        class="action-btn edit"
        title="编辑"
      >
        ✎
      </button>
      <button
        @click="emit('delete', feed.id)"
        class="action-btn delete"
        title="删除"
      >
        🗑
      </button>
    </div>
  </div>
</template>

<style scoped>
.feed-item-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  box-shadow: 0 6px 14px rgba(15, 17, 21, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
  margin: 4px 8px;
}

.feed-item-wrapper:hover {
  border-color: rgba(255, 122, 24, 0.4);
  box-shadow: 0 12px 24px rgba(15, 17, 21, 0.1);
  transform: translateY(-1px);
}

.feed-item-wrapper.active {
  border-color: var(--accent);
  background: rgba(255, 122, 24, 0.08);
  box-shadow: 0 14px 28px rgba(255, 122, 24, 0.15);
}

.feed-item-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  color: var(--text-primary);
  cursor: pointer;
}

.feed-item-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.feed-icon {
  --feed-icon-size: 34px;
  --feed-icon-padding: 4px;
  width: var(--feed-icon-size);
  height: var(--feed-icon-size);
  border-radius: 10px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feed-item-wrapper:hover .feed-icon {
  transform: scale(1.03);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.feed-icon img {
  width: calc(100% - var(--feed-icon-padding));
  height: calc(100% - var(--feed-icon-padding));
  object-fit: contain;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  display: block;
  padding: calc(var(--feed-icon-padding) / 2);
}

.feed-icon__initial {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.feed-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.feed-item__title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-item__url {
  font-size: 11px;
  color: #8a90a3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
}

.feed-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  background: var(--border-color);
}

.status-dot.ok { background: #2ec4b6; }
.status-dot.due { background: #ff6b6b; }
.status-dot.never { background: #9aa0a6; }

.feed-item__edit {
  margin-top: 4px;
}

.group-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.feed-item__badge {
  min-width: 24px;
  height: 24px;
  border-radius: 12px;
  background: rgba(15, 17, 21, 0.08);
  display: grid;
  place-items: center;
  font-size: 12px;
}

.feed-item__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
  color: var(--text-primary);
}

.action-btn:hover {
  border-color: var(--accent);
  background: rgba(255, 122, 24, 0.15);
  color: var(--accent);
  transform: translateY(-1px);
}

.action-btn.delete:hover { background: #ff3b30; color: white; }
.action-btn.edit:hover { background: #007aff; color: white; }
.action-btn.save:hover { background: #34c759; color: white; }
.action-btn.cancel:hover { background: #8e8e93; color: white; }
.action-btn.mark-read { 
  color: #34c759; 
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn.mark-read:hover { background: #34c759; color: white; border-color: #34c759; }
</style>
