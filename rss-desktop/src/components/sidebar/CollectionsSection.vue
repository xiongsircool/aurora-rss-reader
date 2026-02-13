<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '../../stores/collectionsStore'
import { useConfirmDialog } from '../../composables/useConfirmDialog'
import ConfirmModal from '../common/ConfirmModal.vue'

defineProps<{
  expanded: boolean
  activeCollectionId: string | null
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'select-collection', id: string): void
}>()

const { t } = useI18n()
const collectionsStore = useCollectionsStore()
const {
  show: confirmShow,
  options: confirmOptions,
  requestConfirm,
  handleConfirm,
  handleCancel
} = useConfirmDialog()

const showCreateInput = ref(false)
const newName = ref('')
const newColor = ref('#ff7a18')
const editingId = ref<string | null>(null)
const editName = ref('')

const presetColors = [
  '#ff7a18', '#f43f5e', '#8b5cf6', '#3b82f6',
  '#10b981', '#f59e0b', '#6366f1', '#ec4899'
]

const collections = computed(() => collectionsStore.collections)

async function handleCreate() {
  if (!newName.value.trim()) return
  await collectionsStore.createCollection(newName.value.trim(), undefined, newColor.value)
  newName.value = ''
  newColor.value = '#ff7a18'
  showCreateInput.value = false
}

function startEdit(id: string, name: string) {
  editingId.value = id
  editName.value = name
}

async function handleEdit() {
  if (!editingId.value || !editName.value.trim()) return
  await collectionsStore.updateCollection(editingId.value, { name: editName.value.trim() })
  editingId.value = null
  editName.value = ''
}

async function handleDelete(id: string) {
  const confirmed = await requestConfirm({
    title: t('collections.delete'),
    message: t('collections.deleteConfirm'),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true
  })
  if (!confirmed) return
  await collectionsStore.deleteCollection(id)
}
</script>

<template>
  <div class="my-2 rounded-xl border border-[rgba(59,130,246,0.22)] bg-[linear-gradient(180deg,#f0f7ff,rgba(230,240,255,0.92))] shadow-[0_4px_12px_rgba(59,130,246,0.08),0_2px_8px_rgba(15,17,21,0.04)] py-1.5 px-1.5 dark:bg-[linear-gradient(180deg,rgba(16,22,32,0.92),rgba(12,14,18,0.92))] dark:border-[rgba(59,130,246,0.35)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.4),0_0_0_1px_rgba(59,130,246,0.18)]">
    <!-- Toggle Button -->
    <div>
      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border border-transparent rounded-lg text-left cursor-pointer transition-all duration-200 hover:bg-[rgba(59,130,246,0.1)] hover:border-[rgba(59,130,246,0.2)] dark:hover:bg-[rgba(59,130,246,0.2)] dark:hover:border-[rgba(59,130,246,0.4)]"
        :class="{ 'bg-[rgba(59,130,246,0.15)] border-[rgba(59,130,246,0.3)] c-[#3b82f6] dark:bg-[rgba(59,130,246,0.25)] dark:border-[rgba(59,130,246,0.5)]': expanded }"
        @click="emit('toggle')"
      >
        <span class="text-0 leading-none flex items-center" aria-hidden="true">
          <svg class="w-4 h-4 block" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.17l1.42 1.42a2 2 0 0 0 1.41.58H20a2 2 0 0 1 2 2v10z"/>
          </svg>
        </span>
        <span class="flex-1 font-semibold text-[13px] c-[var(--text-primary)] dark:c-[rgba(255,255,255,0.95)]">{{ t('collections.title') }}</span>
        <span v-if="collections.length" class="text-[11px] bg-[#3b82f6] text-white px-1.5 py-0.5 rounded-[10px] font-medium">{{ collections.length }}</span>
      </button>
    </div>

    <!-- Expanded Content -->
    <div v-show="expanded" class="ml-1 mt-1">
      <!-- Create Button -->
      <div class="mb-2 px-1">
        <button
          v-if="!showCreateInput"
          @click.stop="showCreateInput = true"
          class="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] c-[var(--text-secondary)] hover:c-[var(--text-primary)] bg-transparent border border-dashed border-[var(--border-color)] rounded-lg cursor-pointer transition-all hover:bg-[rgba(59,130,246,0.06)] hover:border-[rgba(59,130,246,0.3)]"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ t('collections.create') }}
        </button>

        <!-- Create Input -->
        <div v-else class="space-y-2 p-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)]">
          <div class="flex gap-1.5">
            <input
              v-model="newName"
              :placeholder="t('collections.namePlaceholder')"
              class="flex-1 min-w-0 px-2 py-1 text-[12px] rounded border border-[var(--border-color)] bg-[var(--bg-surface)] focus:border-[#3b82f6] outline-none"
              @keyup.enter="handleCreate"
              @keyup.escape="showCreateInput = false"
            />
            <button
              @click="handleCreate"
              :disabled="!newName.trim()"
              class="px-2 py-1 text-[11px] font-medium rounded bg-[#3b82f6] c-white disabled:opacity-50 hover:opacity-90 whitespace-nowrap"
            >
              {{ t('common.add') }}
            </button>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="newColor = color"
              class="w-3.5 h-3.5 rounded-full transition-all hover:scale-110"
              :class="newColor === color ? 'ring-2 ring-offset-1 ring-[#3b82f6] scale-110' : ''"
              :style="{ backgroundColor: color }"
            />
            <button @click="showCreateInput = false" class="ml-auto text-[11px] c-[var(--text-tertiary)] hover:c-[var(--text-primary)]">
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="collections.length === 0 && !showCreateInput" class="px-3 py-4 text-center">
        <p class="text-[12px] c-[var(--text-tertiary)]">{{ t('collections.noCollections') }}</p>
      </div>

      <!-- Collection Items -->
      <div v-else class="space-y-0.5">
        <button
          v-for="collection in collections"
          :key="collection.id"
          @click="emit('select-collection', collection.id)"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-left cursor-pointer transition-all duration-200 text-[13px] c-inherit dark:c-[var(--text-primary)] hover:bg-[rgba(59,130,246,0.08)] hover:border-[rgba(59,130,246,0.15)] dark:hover:bg-[rgba(59,130,246,0.15)] dark:hover:border-[rgba(59,130,246,0.3)] group"
          :class="{ 'bg-[rgba(59,130,246,0.15)] border-[rgba(59,130,246,0.3)] c-[#3b82f6]! dark:bg-[rgba(59,130,246,0.25)] dark:border-[rgba(59,130,246,0.5)]': activeCollectionId === collection.id }"
        >
          <!-- Edit Mode -->
          <template v-if="editingId === collection.id">
            <input
              v-model="editName"
              class="flex-1 min-w-0 px-1.5 py-0.5 text-[12px] rounded border border-[#3b82f6] bg-[var(--bg-base)] outline-none"
              @keyup.enter="handleEdit"
              @keyup.escape="editingId = null"
              @click.stop
            />
            <button @click.stop="handleEdit" class="p-0.5 rounded hover:bg-[rgba(0,0,0,0.05)] c-[#3b82f6]">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </template>

          <!-- Normal Mode -->
          <template v-else>
            <svg class="w-4 h-4 shrink-0 fill-current" :style="{ color: collection.color }" viewBox="0 0 24 24" stroke="none">
              <path d="M20 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.17l1.42 1.42a2 2 0 0 0 1.41.58H20a2 2 0 0 1 2 2v10z"/>
            </svg>
            <span class="flex-1 truncate">{{ collection.name }}</span>
            <span
              v-if="collection.entry_count"
              class="text-[10px] px-1 py-0 rounded-md font-medium"
              :class="activeCollectionId === collection.id ? 'bg-[#3b82f6] c-white' : 'bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.1)] c-[var(--text-tertiary)]'"
            >
              {{ collection.entry_count }}
            </span>

            <!-- Hover Actions -->
            <div class="hidden group-hover:flex items-center gap-0.5 ml-0.5">
              <button
                @click.stop="startEdit(collection.id, collection.name)"
                class="p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-[rgba(0,0,0,0.05)] transition-all"
                :title="t('common.edit')"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click.stop="handleDelete(collection.id)"
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
