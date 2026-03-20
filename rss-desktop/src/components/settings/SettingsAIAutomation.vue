<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LocalAutomationRule } from '../../composables/useSettingsModal'

const props = withDefaults(defineProps<{
  title?: string
  hint?: string
  badge?: string
  allowInherit?: boolean
}>(), {
  title: '',
  hint: '',
  badge: '',
  allowInherit: false,
})

const rules = defineModel<LocalAutomationRule[]>('rules', { required: true })
const { t } = useI18n()

const taskOptions: Array<{ key: LocalAutomationRule['task_key']; labelKey: string; hintKey: string }> = [
  { key: 'entry_summary', labelKey: 'settings.automationEntrySummary', hintKey: 'settings.automationEntrySummaryHint' },
  { key: 'title_translation', labelKey: 'settings.automationTitleTranslation', hintKey: 'settings.automationTitleTranslationHint' },
  { key: 'aggregate_digest', labelKey: 'settings.automationAggregateDigest', hintKey: 'settings.automationAggregateDigestHint' },
  { key: 'smart_tagging', labelKey: 'settings.automationSmartTagging', hintKey: 'settings.automationSmartTaggingHint' },
]

function setRuleMode(taskKey: LocalAutomationRule['task_key'], mode: LocalAutomationRule['mode']) {
  const currentRules = Array.isArray(rules.value) ? rules.value : []
  const next = currentRules.map((rule) => rule.task_key === taskKey ? { ...rule, mode } : rule)
  rules.value = next
}

function getRuleMode(taskKey: LocalAutomationRule['task_key']) {
  const currentRules = Array.isArray(rules.value) ? rules.value : []
  return currentRules.find((rule) => rule.task_key === taskKey)?.mode || (props.allowInherit ? 'inherit' : 'disabled')
}
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 class="m-0 text-base font-semibold text-[var(--text-primary)]">
          {{ props.title || t('settings.aiAutomation') }}
        </h3>
        <p v-if="props.hint || t('settings.aiAutomationHint')" class="m-[6px_0_0] text-xs leading-5 text-[var(--text-secondary)]">
          {{ props.hint || t('settings.aiAutomationHint') }}
        </p>
      </div>
      <span v-if="props.badge || t('settings.aiAutomationGlobalOnly')" class="shrink-0 px-2 py-1 rounded-full text-[10px] font-medium border border-[var(--border-color)] text-[var(--text-secondary)]">
        {{ props.badge || t('settings.aiAutomationGlobalOnly') }}
      </span>
    </div>

    <div class="space-y-3">
      <div
        v-for="task in taskOptions"
        :key="task.key"
        class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-medium text-[var(--text-primary)]">{{ t(task.labelKey) }}</div>
            <p class="m-[6px_0_0] text-xs leading-5 text-[var(--text-secondary)]">{{ t(task.hintKey) }}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button
              v-if="props.allowInherit"
              type="button"
              class="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
              :class="getRuleMode(task.key) === 'inherit'
                ? 'bg-[rgba(255,122,24,0.12)] text-[var(--accent)] border-[rgba(255,122,24,0.28)]'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'"
              @click="setRuleMode(task.key, 'inherit')"
            >
              {{ t('common.inherit') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
              :class="getRuleMode(task.key) === 'enabled'
                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_4px_12px_rgba(255,122,24,0.22)]'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'"
              @click="setRuleMode(task.key, 'enabled')"
            >
              {{ t('common.enable') }}
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
              :class="getRuleMode(task.key) === 'disabled'
                ? 'bg-[rgba(15,17,21,0.88)] text-white border-[rgba(15,17,21,0.88)] dark:bg-[rgba(255,255,255,0.14)] dark:border-[rgba(255,255,255,0.14)]'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'"
              @click="setRuleMode(task.key, 'disabled')"
            >
              {{ t('common.disable') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
