/**
 * Feed Management Composable
 *
 * Handles feed-level CRUD operations, OPML import/export,
 * mark-as-read, view type switching, and group operations
 * that AppHome.vue delegates to the sidebar.
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore } from '../stores/feedStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotification } from './useNotification'
import { useConfirmDialog } from './useConfirmDialog'
import type { Ref } from 'vue'
import type { ViewType } from '../types'

export function useFeedManagement(options: {
  showFavoritesOnly: Ref<boolean>
  filterMode: Ref<string>
  dateRangeFilter: Ref<string>
  isDateFilterActive: Ref<boolean>
  applyFilters: () => Promise<void>
  debouncedApplyFilters: (opts?: { refreshFeeds?: boolean }) => void
}) {
  const {
    showFavoritesOnly,
    filterMode,
    dateRangeFilter,
    applyFilters,
    debouncedApplyFilters,
  } = options

  const store = useFeedStore()
  const settingsStore = useSettingsStore()
  const { t } = useI18n()
  const { showNotification } = useNotification()
  const {
    show: confirmShow,
    options: confirmOptions,
    requestConfirm,
    handleConfirm,
    handleCancel,
  } = useConfirmDialog()

  const editingFeedId = ref<string | null>(null)
  const editingGroupName = ref('')
  const importLoading = ref(false)

  // === Feed CRUD ===

  async function handleAddFeed(url: string) {
    if (!url) return
    try {
      let targetGroupName: string | null | undefined
      if (!showFavoritesOnly.value) {
        targetGroupName = store.activeGroupName
        if (!targetGroupName && store.activeFeedId) {
          const activeFeed = store.feeds.find((feed) => feed.id === store.activeFeedId)
          targetGroupName = activeFeed?.group_name
        }
      }
      await store.addFeed(url, { groupName: targetGroupName })
      showNotification(t('feeds.addSuccess'), 'success')
    } catch {
      showNotification(t('feeds.addFailed'), 'error')
    }
  }

  async function handleDeleteFeed(feedId: string) {
    const confirmed = await requestConfirm({
      title: t('feeds.deleteFeed'),
      message: t('feeds.deleteConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      danger: true,
    })
    if (!confirmed) return
    try {
      await store.deleteFeed(feedId)
      showNotification(t('feeds.deleteSuccess'), 'success')
    } catch {
      showNotification(t('feeds.deleteFailed'), 'error')
    }
  }

  function startEditFeed(feedId: string, currentGroup: string) {
    editingFeedId.value = feedId
    editingGroupName.value = currentGroup
  }

  async function saveEditFeed(feedId: string) {
    try {
      await store.updateFeed(feedId, { group_name: editingGroupName.value })
      editingFeedId.value = null
      showNotification(t('feeds.updateSuccess'), 'success')
    } catch {
      showNotification(t('feeds.updateFailed'), 'error')
    }
  }

  function cancelEdit() {
    editingFeedId.value = null
  }

  // === OPML ===

  async function handleExportOpml() {
    try {
      await store.exportOpml()
      showNotification(t('opml.exportSuccess'), 'success')
    } catch {
      showNotification(t('opml.exportFailed'), 'error')
    }
  }

  async function handleImportOpml(file: File) {
    if (!file) return
    importLoading.value = true
    try {
      const result = await store.importOpml(file)
      showNotification(
        t('opml.importSuccess', { imported: result.imported, skipped: result.skipped }),
        'success',
      )
    } catch {
      showNotification(t('opml.importFailed'), 'error')
    } finally {
      importLoading.value = false
    }
  }

  // === Reload / Refresh ===

  function reloadFeeds() {
    if (typeof debouncedApplyFilters === 'function') {
      debouncedApplyFilters({ refreshFeeds: true })
    } else {
      store.fetchFeeds()
    }
  }

  // === Mark as read ===

  async function handleMarkAllAsRead() {
    const markAsReadRange = settingsStore.settings.mark_as_read_range
    const timeField = settingsStore.settings.time_field

    const confirmed = await requestConfirm({
      title: t('articles.markAsRead'),
      message: t('articles.markAsReadConfirmAll'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    })
    if (!confirmed) return

    try {
      const olderThan = (markAsReadRange === 'all' || markAsReadRange === 'current')
        ? undefined
        : markAsReadRange
      const result = await store.markAsRead({
        feedId: store.activeFeedId ?? undefined,
        groupName: store.activeGroupName ?? undefined,
        olderThan,
        timeField,
      })
      if (result.marked_count > 0) {
        showNotification(t('articles.markAsReadSuccess', { count: result.marked_count }), 'success')
        await applyFilters()
      } else {
        showNotification(t('articles.markAsReadEmpty'), 'info')
      }
    } catch (error) {
      console.error('Mark as read failed:', error)
      showNotification(t('articles.markAsReadFailed'), 'error')
    }
  }

  async function handleMarkGroupAsRead(groupName: string) {
    const markAsReadRange = settingsStore.settings.mark_as_read_range
    const timeField = settingsStore.settings.time_field

    try {
      const olderThan = (markAsReadRange === 'all' || markAsReadRange === 'current')
        ? undefined
        : markAsReadRange
      const result = await store.markAsRead({ groupName, olderThan, timeField })
      if (result.marked_count > 0) {
        showNotification(t('articles.markAsReadSuccess', { count: result.marked_count }), 'success')
        await applyFilters()
      } else {
        showNotification(t('articles.markAsReadEmpty'), 'info')
      }
    } catch (error) {
      console.error('Mark group as read failed:', error)
      showNotification(t('articles.markAsReadFailed'), 'error')
    }
  }

  async function handleMarkFeedAsRead(feedId: string) {
    const markAsReadRange = settingsStore.settings.mark_as_read_range
    const timeField = settingsStore.settings.time_field

    try {
      const olderThan = (markAsReadRange === 'all' || markAsReadRange === 'current')
        ? undefined
        : markAsReadRange
      const result = await store.markAsRead({ feedId, olderThan, timeField })
      if (result.marked_count > 0) {
        showNotification(t('articles.markAsReadSuccess', { count: result.marked_count }), 'success')
        await applyFilters()
      } else {
        showNotification(t('articles.markAsReadEmpty'), 'info')
      }
    } catch (error) {
      console.error('Mark feed as read failed:', error)
      showNotification(t('articles.markAsReadFailed'), 'error')
    }
  }

  // === View type ===

  async function handleSelectViewType(viewType: string) {
    store.selectViewType(viewType as ViewType)
    await store.fetchEntries({
      viewType: viewType as ViewType,
      unreadOnly: filterMode.value === 'unread',
      dateRange: dateRangeFilter.value,
      timeField: settingsStore.settings.time_field,
    })
  }

  async function handleChangeViewType(feedId: string, viewType: string) {
    try {
      await store.updateFeedViewType(feedId, viewType as ViewType)
      showNotification(t('feeds.viewTypeChanged'), 'success')
    } catch (error) {
      console.error('Change view type failed:', error)
      showNotification(t('feeds.viewTypeChangeFailed'), 'error')
    }
  }

  // === Group operations ===

  async function handleMoveToGroup(feedId: string, groupName: string) {
    try {
      await store.updateFeed(feedId, { group_name: groupName })
      showNotification(t('feeds.moveToGroupSuccess'), 'success')
    } catch (error) {
      console.error('Move to group failed:', error)
      showNotification(t('feeds.moveToGroupFailed'), 'error')
    }
  }

  async function handleSetCustomTitle(feedId: string, customTitle: string | null) {
    try {
      await store.updateFeed(feedId, { custom_title: customTitle })
      showNotification(t('feeds.aliasSetSuccess'), 'success')
    } catch (error) {
      console.error('Set custom title failed:', error)
      showNotification(t('feeds.aliasSetFailed'), 'error')
    }
  }

  return {
    // Confirm dialog (exposed for ConfirmModal binding)
    confirmShow,
    confirmOptions,
    handleConfirm,
    handleCancel,

    // State
    editingFeedId,
    editingGroupName,
    importLoading,

    // Actions
    handleAddFeed,
    handleDeleteFeed,
    startEditFeed,
    saveEditFeed,
    cancelEdit,
    handleExportOpml,
    handleImportOpml,
    reloadFeeds,
    handleMarkAllAsRead,
    handleMarkGroupAsRead,
    handleMarkFeedAsRead,
    handleSelectViewType,
    handleChangeViewType,
    handleMoveToGroup,
    handleSetCustomTitle,
  }
}
