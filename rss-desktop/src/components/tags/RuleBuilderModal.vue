<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TagMatchRule } from '../../stores/tagsStore'

const props = defineProps<{
  show: boolean
  rules: TagMatchRule[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', rules: TagMatchRule[]): void
}>()

const { t } = useI18n()

// Local editable copy of rules
const localRules = ref<TagMatchRule[]>([])

// Sync when modal opens
watch(() => props.show, (val) => {
  if (val) {
    localRules.value = props.rules.length > 0
      ? JSON.parse(JSON.stringify(props.rules))
      : [{ keywords: [], operator: 'OR' as const, exclude: [] }]
  }
})

// Input state for adding new keywords
const newKeyword = ref<Record<number, string>>({})
const newExclude = ref<Record<number, string>>({})

function addRuleGroup() {
  localRules.value.push({ keywords: [], operator: 'OR', exclude: [] })
}

function removeRuleGroup(index: number) {
  localRules.value.splice(index, 1)
  if (localRules.value.length === 0) {
    localRules.value.push({ keywords: [], operator: 'OR', exclude: [] })
  }
}

function addKeyword(groupIndex: number) {
  const kw = (newKeyword.value[groupIndex] || '').trim()
  if (!kw) return
  if (!localRules.value[groupIndex].keywords.includes(kw)) {
    localRules.value[groupIndex].keywords.push(kw)
  }
  newKeyword.value[groupIndex] = ''
}

function removeKeyword(groupIndex: number, kwIndex: number) {
  localRules.value[groupIndex].keywords.splice(kwIndex, 1)
}

function addExclude(groupIndex: number) {
  const ex = (newExclude.value[groupIndex] || '').trim()
  if (!ex) return
  if (!localRules.value[groupIndex].exclude) {
    localRules.value[groupIndex].exclude = []
  }
  if (!localRules.value[groupIndex].exclude.includes(ex)) {
    localRules.value[groupIndex].exclude.push(ex)
  }
  newExclude.value[groupIndex] = ''
}

function removeExclude(groupIndex: number, exIndex: number) {
  localRules.value[groupIndex].exclude.splice(exIndex, 1)
}

function toggleOperator(groupIndex: number) {
  localRules.value[groupIndex].operator =
    localRules.value[groupIndex].operator === 'AND' ? 'OR' : 'AND'
}

const hasValidRules = computed(() => {
  return localRules.value.some(r => r.keywords.length > 0)
})

function handleSave() {
  // Filter out empty groups
  const validRules = localRules.value.filter(r => r.keywords.length > 0)
  emit('save', validRules)
  emit('close')
}

function handleCancel() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-1000 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="handleCancel" />

      <!-- Modal -->
      <div class="relative w-[520px] max-h-[80vh] bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)]">
          <div>
            <h3 class="text-[15px] font-semibold c-[var(--text-primary)]">{{ t('tags.ruleBuilder') }}</h3>
            <p class="text-[11px] c-[var(--text-tertiary)] mt-0.5">{{ t('tags.ruleBuilderHint') }}</p>
          </div>
          <button
            @click="handleCancel"
            class="p-1 rounded-lg c-[var(--text-tertiary)] hover:c-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)]"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div
            v-for="(rule, gi) in localRules"
            :key="gi"
            class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] p-3.5 space-y-3"
          >
            <!-- Group header -->
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-semibold c-[var(--text-tertiary)] uppercase tracking-wider">
                {{ t('tags.ruleGroup') }} {{ gi + 1 }}
              </span>
              <button
                v-if="localRules.length > 1"
                @click="removeRuleGroup(gi)"
                class="p-0.5 rounded c-[var(--text-tertiary)] hover:c-[#ff3b30] hover:bg-[rgba(255,59,48,0.1)] transition-all"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>

            <!-- Keywords section -->
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-[11px] font-medium c-[var(--text-secondary)]">{{ t('tags.ruleKeywords') }}</span>
                <button
                  @click="toggleOperator(gi)"
                  class="px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer"
                  :class="rule.operator === 'AND'
                    ? 'bg-[rgba(59,130,246,0.15)] c-[#3b82f6] border border-[rgba(59,130,246,0.3)]'
                    : 'bg-[rgba(249,115,22,0.15)] c-[#f97316] border border-[rgba(249,115,22,0.3)]'"
                >
                  {{ rule.operator }}
                </button>
              </div>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="(kw, ki) in rule.keywords"
                  :key="ki"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-lg bg-[rgba(139,92,246,0.1)] c-[#8b5cf6] border border-[rgba(139,92,246,0.2)]"
                >
                  {{ kw }}
                  <button
                    @click="removeKeyword(gi, ki)"
                    class="ml-0.5 p-0 c-[rgba(139,92,246,0.5)] hover:c-[#8b5cf6] transition-colors"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
                <div class="inline-flex items-center">
                  <input
                    v-model="newKeyword[gi]"
                    @keyup.enter="addKeyword(gi)"
                    :placeholder="t('tags.ruleAddKeyword')"
                    class="w-24 px-2 py-0.5 text-[12px] rounded-lg border border-dashed border-[var(--border-color)] bg-transparent focus:border-[#8b5cf6] outline-none c-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>

            <!-- Exclude section -->
            <div>
              <span class="text-[11px] font-medium c-[var(--text-secondary)] block mb-1.5">
                NOT ({{ t('tags.ruleExclude') }})
              </span>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(ex, ei) in rule.exclude"
                  :key="ei"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-lg bg-[rgba(255,59,48,0.1)] c-[#ff3b30] border border-[rgba(255,59,48,0.2)]"
                >
                  {{ ex }}
                  <button
                    @click="removeExclude(gi, ei)"
                    class="ml-0.5 p-0 c-[rgba(255,59,48,0.5)] hover:c-[#ff3b30] transition-colors"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
                <div class="inline-flex items-center">
                  <input
                    v-model="newExclude[gi]"
                    @keyup.enter="addExclude(gi)"
                    :placeholder="t('tags.ruleAddExclude')"
                    class="w-24 px-2 py-0.5 text-[12px] rounded-lg border border-dashed border-[var(--border-color)] bg-transparent focus:border-[#ff3b30] outline-none c-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- OR divider between groups -->
          <div v-if="localRules.length > 0" class="flex items-center justify-center">
            <button
              @click="addRuleGroup"
              class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg c-[var(--text-tertiary)] border border-dashed border-[var(--border-color)] hover:c-[var(--text-primary)] hover:border-[rgba(139,92,246,0.3)] hover:bg-[rgba(139,92,246,0.05)] transition-all"
            >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {{ t('tags.ruleAddGroup') }} (OR)
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
          <button
            @click="handleCancel"
            class="px-3 py-1.5 text-[12px] rounded-lg c-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] transition-all"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleSave"
            :disabled="!hasValidRules"
            class="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[#8b5cf6] c-white hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
