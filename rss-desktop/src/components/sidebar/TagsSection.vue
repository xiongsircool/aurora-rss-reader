<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore } from '../../stores/tagsStore'
import { useConfirmDialog } from '../../composables/useConfirmDialog'
import ConfirmModal from '../common/ConfirmModal.vue'

defineProps<{
  expanded: boolean
  activeTagId: string | null
  activeTagView: 'tag' | 'pending' | 'untagged' | null
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'select-tag', id: string): void
  (e: 'select-tag-view', view: 'pending' | 'untagged'): void
  (e: 'open-tag-settings'): void
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()
const {
  show: confirmShow,
  options: confirmOptions,
  requestConfirm,
  handleConfirm,
  handleCancel
} = useConfirmDialog()

const showCreateInput = ref(false)
const newTagName = ref('')
const newTagDescription = ref('')
const newTagColor = ref('#8b5cf6')
const editingId = ref<string | null>(null)
const editName = ref('')

const presetColors = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#f43f5e', '#ec4899', '#6366f1', '#ff7a18'
]

const tags = computed(() => tagsStore.tags)
const pendingCount = computed(() => tagsStore.stats.pending)

async function handleCreate() {
  if (!newTagName.value.trim()) return
  await tagsStore.createTag({
    name: newTagName.value.trim(),
    description: newTagDescription.value.trim() || undefined,
    color: newTagColor.value
  })
  newTagName.value = ''
  newTagDescription.value = ''
  newTagColor.value = '#8b5cf6'
  showCreateInput.value = false
}

function startEdit(id: string, name: string) {
  editingId.value = id
  editName.value = name
}

async function handleEdit() {
  if (!editingId.value || !editName.value.trim()) return
  await tagsStore.updateTag(editingId.value, { name: editName.value.trim() })
  editingId.value = null
  editName.value = ''
}

async function handleDelete(id: string) {
  const tag = tags.value.find(t => t.id === id)
  const confirmed = await requestConfirm({
    title: t('tags.delete'),
    message: t('tags.confirmDelete', { name: tag?.name || '' }),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true
  })
  if (!confirmed) return
  await tagsStore.deleteTag(id)
}

async function handleAnalyzeAll() {
  if (pendingCount.value === 0) return
  // Fetch pending entries first, then analyze
  await tagsStore.fetchPendingEntries(true)
  const ids = tagsStore.entries.map(e => e.id)
  if (ids.length > 0) {
    await tagsStore.analyzeEntries(ids)
    // Refresh data
    await tagsStore.fetchStats()
    await tagsStore.fetchTags()
  }
}
</script>

<template>
  <div class="my-2 rounded-xl border border-[rgba(139,92,246,0.22)] bg-[linear-gradient(180deg,#f5f0ff,rgba(240,230,255,0.92))] relative shadow-[0_4px_12px_rgba(139,92,246,0.08),0_2px_8px_rgba(15,17,21,0.04)] py-1.5 px-1.5 dark:bg-[linear-gradient(180deg,rgba(24,16,32,0.92),rgba(14,12,18,0.92))] dark:border-[rgba(139,92,246,0.35)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.4),0_0_0_1px_rgba(139,92,246,0.18)]">
    <!-- Toggle Button -->
    <div>
      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border border-transparent rounded-lg text-left cursor-pointer transition-all duration-200 hover:bg-[rgba(139,92,246,0.1)] hover:border-[rgba(139,92,246,0.2)] dark:hover:bg-[rgba(139,92,246,0.2)] dark:hover:border-[rgba(139,92,246,0.4)]"
        :class="{ 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] c-[#8b5cf6] dark:bg-[rgba(139,92,246,0.25)] dark:border-[rgba(139,92,246,0.5)]': expanded }"
        @click="emit('toggle')"
      >
        <span class="text-0 leading-none flex items-center" aria-hidden="true">
          <svg class="w-4 h-4 block" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <circle cx="7" cy="7" r="1.5"/>
          </svg>
        </span>
        <span class="flex-1 font-semibold text-[13px] c-[var(--text-primary)] dark:c-[rgba(255,255,255,0.95)]">{{ t('tags.title') }}</span>
        <span v-if="tags.length" class="text-[11px] bg-[#8b5cf6] text-white px-1.5 py-0.5 rounded-[10px] font-medium">{{ tags.length }}</span>
      </button>
      <button
        v-show="expanded"
        @click.stop="emit('open-tag-settings')"
        class="absolute top-1.5 right-1.5 p-1 rounded-md c-[var(--text-tertiary)] hover:c-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] transition-colors"
        :title="t('tags.settings')"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4 1.65 1.65 0 0 0 13 21v.09a2 2 0 0 1-4 0V21a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15 1.65 1.65 0 0 0 3 13H2.91a2 2 0 0 1 0-4H3a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 11 3V2.91a2 2 0 0 1 4 0V3a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.37.23.82.36 1.3.36H21.09a2 2 0 0 1 0 4H21a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <!-- Expanded Content -->
    <div v-show="expanded" class="ml-1 mt-1">
      <!-- Special Views: Pending & Untagged -->
      <div class="mb-2 space-y-0.5">
        <button
          @click="emit('select-tag-view', 'pending')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-left cursor-pointer transition-all duration-200 text-[12px] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] dark:hover:bg-[rgba(139,92,246,0.15)]"
          :class="{ 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] c-[#8b5cf6]! dark:bg-[rgba(139,92,246,0.25)]': activeTagView === 'pending' }"
        >
          <svg class="w-3.5 h-3.5 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span class="flex-1 c-[var(--text-secondary)]">{{ t('tags.pending') }}</span>
          <span v-if="pendingCount > 0" class="text-[10px] bg-[rgba(255,122,24,0.15)] c-[var(--accent)] px-1.5 py-0.5 rounded-md font-medium">{{ pendingCount }}</span>
        </button>
        <button
          @click="emit('select-tag-view', 'untagged')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-left cursor-pointer transition-all duration-200 text-[12px] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] dark:hover:bg-[rgba(139,92,246,0.15)]"
          :class="{ 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] c-[#8b5cf6]! dark:bg-[rgba(139,92,246,0.25)]': activeTagView === 'untagged' }"
        >
          <svg class="w-3.5 h-3.5 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/>
          </svg>
          <span class="flex-1 c-[var(--text-secondary)]">{{ t('tags.untagged') }}</span>
        </button>
      </div>

      <!-- Analyze All Button -->
      <div v-if="pendingCount > 0" class="mb-2 px-1">
        <button
          @click="handleAnalyzeAll"
          :disabled="tagsStore.analyzing"
          class="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-[rgba(139,92,246,0.1)] c-[#8b5cf6] border border-[rgba(139,92,246,0.2)] hover:bg-[rgba(139,92,246,0.18)] transition-all disabled:opacity-50"
        >
          <svg v-if="!tagsStore.analyzing" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <div v-else class="animate-spin w-3.5 h-3.5 border-2 border-[#8b5cf6] border-t-transparent rounded-full"></div>
          {{ tagsStore.analyzing ? t('tags.analyzing') : t('tags.analyzeAll') }}
        </button>
      </div>

      <!-- Divider -->
      <div v-if="tags.length > 0" class="px-2 py-1 text-[10px] font-medium c-[var(--text-tertiary)] uppercase tracking-wider">
        {{ t('tags.myTags') }}
      </div>

      <!-- Create Button -->
      <div class="mb-1.5 px-1">
        <button
          v-if="!showCreateInput"
          @click.stop="showCreateInput = true"
          class="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] c-[var(--text-secondary)] hover:c-[var(--text-primary)] bg-transparent border border-dashed border-[var(--border-color)] rounded-lg cursor-pointer transition-all hover:bg-[rgba(139,92,246,0.06)] hover:border-[rgba(139,92,246,0.3)]"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ t('tags.create') }}
        </button>

        <!-- Create Input -->
        <div v-else class="space-y-2 p-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)]">
          <input
            v-model="newTagName"
            :placeholder="t('tags.namePlaceholder')"
            class="w-full px-2 py-1 text-[12px] rounded border border-[var(--border-color)] bg-[var(--bg-surface)] focus:border-[#8b5cf6] outline-none"
            @keyup.enter="handleCreate"
            @keyup.escape="showCreateInput = false"
          />
          <input
            v-model="newTagDescription"
            :placeholder="t('tags.descriptionPlaceholder')"
            class="w-full px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-surface)] focus:border-[#8b5cf6] outline-none"
          />
          <div class="flex items-center gap-1.5">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="newTagColor = color"
              class="w-3.5 h-3.5 rounded-full transition-all hover:scale-110"
              :class="newTagColor === color ? 'ring-2 ring-offset-1 ring-[#8b5cf6] scale-110' : ''"
              :style="{ backgroundColor: color }"
            />
          </div>
          <div class="flex justify-end gap-1.5">
            <button @click="showCreateInput = false" class="px-2 py-1 text-[11px] c-[var(--text-tertiary)] hover:c-[var(--text-primary)]">
              {{ t('common.cancel') }}
            </button>
            <button
              @click="handleCreate"
              :disabled="!newTagName.trim()"
              class="px-2 py-1 text-[11px] font-medium rounded bg-[#8b5cf6] c-white disabled:opacity-50 hover:opacity-90"
            >
              {{ t('common.add') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="tags.length === 0 && !showCreateInput" class="px-3 py-3 text-center">
        <p class="text-[12px] c-[var(--text-tertiary)]">{{ t('tags.noTags') }}</p>
      </div>

      <!-- Tag Items -->
      <div v-else class="space-y-0.5">
        <button
          v-for="tag in tags"
          :key="tag.id"
          @click="emit('select-tag', tag.id)"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-left cursor-pointer transition-all duration-200 text-[13px] c-inherit dark:c-[var(--text-primary)] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] dark:hover:bg-[rgba(139,92,246,0.15)] dark:hover:border-[rgba(139,92,246,0.3)] group relative"
          :class="{ 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] c-[#8b5cf6]! dark:bg-[rgba(139,92,246,0.25)] dark:border-[rgba(139,92,246,0.5)]': activeTagId === tag.id }"
        >
          <!-- Edit Mode -->
          <template v-if="editingId === tag.id">
            <input
              v-model="editName"
              class="flex-1 min-w-0 px-1.5 py-0.5 text-[12px] rounded border border-[#8b5cf6] bg-[var(--bg-base)] outline-none"
              @keyup.enter="handleEdit"
              @keyup.escape="editingId = null"
              @click.stop
            />
            <button @click.stop="handleEdit" class="p-0.5 rounded hover:bg-[rgba(0,0,0,0.05)] c-[#8b5cf6]">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </template>

          <!-- Normal Mode -->
          <template v-else>
            <!-- Color indicator -->
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
            <span class="flex-1 truncate font-medium">{{ tag.name }}</span>
            <span
              v-if="tag.entry_count"
              class="text-[10px] px-1 py-0 rounded-md font-medium tabular-nums"
              :class="activeTagId === tag.id ? 'bg-[#8b5cf6] c-white' : 'bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.1)] c-[var(--text-tertiary)]'"
            >
              {{ tag.entry_count }}
            </span>

            <!-- Hover Actions -->
            <div class="hidden group-hover:flex items-center gap-0.5 ml-0.5">
              <button
                @click.stop="startEdit(tag.id, tag.name)"
                class="p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-[rgba(0,0,0,0.05)] transition-all"
                :title="t('common.edit')"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click.stop="handleDelete(tag.id)"
                class="p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-[rgba(255,59,48,0.1)] hover:c-[#ff3b30] transition-all"
                :title="t('common.delete')"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </template>
        </button>
      </div>
    </div>
  </div>

  <ConfirmModal
    :show="confirmShow"
    :title="confirmOptions.title || ''"
    :message="confirmOptions.message"
    :confirm-text="confirmOptions.confirmText"
    :cancel-text="confirmOptions.cancelText"
    :danger="confirmOptions.danger"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>
