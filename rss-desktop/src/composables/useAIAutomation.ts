import { computed } from 'vue'
import { useAIStore, type AITaskKey, type AIAutomationMode } from '../stores/aiStore'
import { useFeedStore } from '../stores/feedStore'
import type { Entry, Feed } from '../types'

interface AutomationContext {
  feedId?: string | null
  groupName?: string | null
}

function normalizeGroupName(groupName?: string | null): string | null {
  return groupName && groupName.trim().length > 0 ? groupName : null
}

export function useAIAutomation() {
  const aiStore = useAIStore()
  const feedStore = useFeedStore()

  const automationRevision = computed(() => JSON.stringify({
    rules: aiStore.automationRules,
    defaults: aiStore.automationDefaults,
    features: aiStore.config.features,
    feeds: feedStore.feeds.map((feed) => ({ id: feed.id, group_name: feed.group_name || '' })),
  }))

  function getLegacyFallbackEnabled(taskKey: AITaskKey): boolean {
    switch (taskKey) {
      case 'entry_summary':
        return !!aiStore.config.features.auto_summary
      case 'title_translation':
        return !!aiStore.config.features.auto_title_translation
      case 'smart_tagging':
        return !!aiStore.config.features.auto_tagging
      case 'aggregate_digest':
        return true
      case 'fulltext_translation':
        return false
      default:
        return false
    }
  }

  function findRuleMode(taskKey: AITaskKey, scopeType: 'global' | 'feed' | 'group', scopeId: string | null): AIAutomationMode | null {
    const rule = aiStore.automationRules.find((item) =>
      item.task_key === taskKey &&
      item.scope_type === scopeType &&
      item.scope_id === scopeId
    )
    return rule?.mode ?? null
  }

  function resolveContext(input?: AutomationContext | null): Required<AutomationContext> {
    const feedId = input?.feedId ?? null
    const feed = feedId
      ? feedStore.feeds.find((item) => item.id === feedId) ?? null
      : null
    return {
      feedId,
      groupName: normalizeGroupName(input?.groupName ?? feed?.group_name ?? null),
    }
  }

  function resolveAutomationMode(taskKey: AITaskKey, input?: AutomationContext | null): AIAutomationMode {
    const context = resolveContext(input)

    if (context.feedId) {
      const feedMode = findRuleMode(taskKey, 'feed', context.feedId)
      if (feedMode && feedMode !== 'inherit') {
        return feedMode
      }
    }

    if (context.groupName) {
      const groupMode = findRuleMode(taskKey, 'group', context.groupName)
      if (groupMode && groupMode !== 'inherit') {
        return groupMode
      }
    }

    const globalMode = findRuleMode(taskKey, 'global', null)
    if (globalMode && globalMode !== 'inherit') {
      return globalMode
    }

    const fallback = aiStore.automationDefaults.find((item) => item.task_key === taskKey)
    if (fallback) {
      return fallback.enabled ? 'enabled' : 'disabled'
    }

    return getLegacyFallbackEnabled(taskKey) ? 'enabled' : 'disabled'
  }

  function isTaskEnabled(taskKey: AITaskKey, input?: AutomationContext | null): boolean {
    return resolveAutomationMode(taskKey, input) === 'enabled'
  }

  function isEntryTaskEnabled(taskKey: Extract<AITaskKey, 'entry_summary' | 'title_translation' | 'smart_tagging'>, entry: Entry | null | undefined): boolean {
    if (!entry) return false
    return isTaskEnabled(taskKey, { feedId: entry.feed_id })
  }

  function isFeedTaskEnabled(taskKey: AITaskKey, feed: Feed | null | undefined): boolean {
    if (!feed) return isTaskEnabled(taskKey)
    return isTaskEnabled(taskKey, {
      feedId: feed.id,
      groupName: feed.group_name,
    })
  }

  return {
    automationRevision,
    resolveAutomationMode,
    isTaskEnabled,
    isEntryTaskEnabled,
    isFeedTaskEnabled,
  }
}
