/**
 * Feed Group Management
 *
 * Extracted from feedStore: manages collapsed/custom group state
 * persisted to localStorage.
 */

import { ref, computed, type ComputedRef } from 'vue'
import type { Feed } from '../types'

export function useFeedGroups(
  filteredFeeds: ComputedRef<Feed[]>,
  customGroupsInit?: Set<string>,
) {
  const collapsedGroups = ref<Set<string>>(new Set())
  const customGroups = ref<Set<string>>(customGroupsInit ?? new Set())

  // 分组
  const groupedFeeds = computed(() => {
    const groups: Record<string, Feed[]> = {}

    filteredFeeds.value.forEach(feed => {
      const groupName = feed.group_name || '未分组'
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(feed)
    })

    customGroups.value.forEach(groupName => {
      if (!groups[groupName]) groups[groupName] = []
    })

    Object.keys(groups).forEach(groupName => {
      groups[groupName].sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url))
    })

    return groups
  })

  const groupStats = computed(() => {
    const stats: Record<string, { feedCount: number; unreadCount: number }> = {}
    Object.entries(groupedFeeds.value).forEach(([groupName, groupFeeds]) => {
      stats[groupName] = {
        feedCount: groupFeeds.length,
        unreadCount: groupFeeds.reduce((sum, feed) => sum + (feed.unread_count || 0), 0),
      }
    })
    return stats
  })

  const sortedGroupNames = computed(() => {
    return Object.keys(groupedFeeds.value).sort((a, b) => {
      if (a === '未分组') return 1
      if (b === '未分组') return -1
      return a.localeCompare(b)
    })
  })

  // === Collapsed Groups ===

  function toggleGroupCollapse(groupName: string) {
    if (collapsedGroups.value.has(groupName)) {
      collapsedGroups.value.delete(groupName)
    } else {
      collapsedGroups.value.add(groupName)
    }
    localStorage.setItem('collapsedGroups', JSON.stringify([...collapsedGroups.value]))
  }

  function isGroupCollapsed(groupName: string) {
    return collapsedGroups.value.has(groupName)
  }

  function expandAllGroups() {
    collapsedGroups.value.clear()
    localStorage.removeItem('collapsedGroups')
  }

  function collapseAllGroups() {
    collapsedGroups.value = new Set(sortedGroupNames.value)
    localStorage.setItem('collapsedGroups', JSON.stringify([...collapsedGroups.value]))
  }

  function loadCollapsedGroups() {
    const saved = localStorage.getItem('collapsedGroups')
    if (saved) {
      try { collapsedGroups.value = new Set(JSON.parse(saved)) }
      catch (e) { console.error('Failed to load collapsed groups:', e) }
    }
  }

  // === Custom Groups ===

  function loadCustomGroups() {
    const saved = localStorage.getItem('customGroups')
    if (saved) {
      try { customGroups.value = new Set(JSON.parse(saved)) }
      catch (e) { console.error('Failed to load custom groups:', e) }
    }
  }

  function saveCustomGroups() {
    localStorage.setItem('customGroups', JSON.stringify([...customGroups.value]))
  }

  function createGroup(name: string) {
    if (!name || name.trim() === '') return
    const trimmedName = name.trim()
    if (customGroups.value.has(trimmedName)) return
    if (Object.keys(groupedFeeds.value).includes(trimmedName)) return
    customGroups.value.add(trimmedName)
    saveCustomGroups()
  }

  function deleteGroup(name: string) {
    customGroups.value.delete(name)
    saveCustomGroups()
  }

  // Load persisted state on creation
  loadCollapsedGroups()
  loadCustomGroups()

  return {
    collapsedGroups,
    customGroups,
    groupedFeeds,
    groupStats,
    sortedGroupNames,
    toggleGroupCollapse,
    isGroupCollapsed,
    expandAllGroups,
    collapseAllGroups,
    loadCollapsedGroups,
    loadCustomGroups,
    createGroup,
    deleteGroup,
  }
}
