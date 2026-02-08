<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '../../stores/collectionsStore'
import ConfirmModal from '../common/ConfirmModal.vue'
import { useConfirmDialog } from '../../composables/useConfirmDialog'

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

// 预设颜色
const presetColors = [
  '#ff7a18', '#f43f5e', '#8b5cf6', '#3b82f6',
  '#10b981', '#f59e0b', '#6366f1', '#ec4899'
]

const collections = computed(() => collectionsStore.collections)
const selectedId = computed(() => collectionsStore.activeCollectionId)

onMounted(async () => {
  await collectionsStore.fetchCollections()
  if (collections.value.length > 0 && !selectedId.value) {
    await selectAndFetch(collections.value[0].id)
  }
})

async function selectAndFetch(id: string) {
  collectionsStore.selectCollection(id)
  await collectionsStore.fetchCollectionEntries(id)
}

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

// 拖拽排序
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function handleDragStart(id: string) {
  draggedId.value = id
}

function handleDragOver(e: DragEvent, id: string) {
  e.preventDefault()
  dragOverId.value = id
}

function handleDragLeave() {
  dragOverId.value = null
}

async function handleDrop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId) {
    draggedId.value = null
    dragOverId.value = null
    return
  }

  const items = [...collections.value]
  const draggedIndex = items.findIndex(c => c.id === draggedId.value)
  const targetIndex = items.findIndex(c => c.id === targetId)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    const [removed] = items.splice(draggedIndex, 1)
    items.splice(targetIndex, 0, removed)

    // 更新排序
    for (let i = 0; i < items.length; i++) {
      if (items[i].sort_order !== i) {
        await collectionsStore.updateCollection(items[i].id, { sort_order: i })
      }
    }
  }

  draggedId.value = null
  dragOverId.value = null
}
</script>

<template>
  <aside class="h-full border-r border-[var(--border-color)] bg-[var(--bg-elevated)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div class="flex items-center gap-2">
        <h2 class="font-medium text-[14px] c-[var(--text-primary)]">{{ t('collections.title') }}</h2>
        <span class="px-1.5 py-0.5 rounded-full bg-[var(--bg-base)] text-[10px] c-[var(--text-tertiary)] font-medium border border-[var(--border-color)]">
          {{ collections.length }}
        </span>
      </div>
      <button
        @click="showCreateInput = !showCreateInput"
        class="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] transition-colors c-[var(--text-secondary)] hover:c-[var(--text-primary)]"
        :title="t('collections.create')"
        :class="{ 'bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.1)] c-[var(--text-primary)]': showCreateInput }"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- Create Input -->
    <div v-if="showCreateInput" class="px-3 py-3 border-b border-[var(--border-color)] bg-[var(--bg-base)] animate-fade-in-down">
      <div class="flex gap-2 mb-3">
        <input
          v-model="newName"
          :placeholder="t('collections.namePlaceholder')"
          class="flex-1 px-2.5 py-1.5 text-[13px] rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] focus:border-[var(--accent)] outline-none transition-colors"
          @keyup.enter="handleCreate"
          ref="createInputRef"
        />
        <button
          @click="handleCreate"
          :disabled="!newName.trim()"
          class="px-3 py-1.5 text-[12px] font-medium rounded-md bg-[var(--accent)] c-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {{ t('common.add') }}
        </button>
      </div>
      <!-- Color Picker -->
      <div class="flex items-center gap-2 justify-between px-1">
        <span class="text-[11px] c-[var(--text-secondary)]">{{ t('collections.color') }}</span>
        <div class="flex items-center gap-1.5">
          <button
            v-for="color in presetColors"
            :key="color"
            @click="newColor = color"
            class="w-4 h-4 rounded-full transition-all hover:scale-110 focus:outline-none"
            :class="newColor === color ? 'ring-2 ring-offset-2 ring-[var(--accent)] scale-110' : 'hover:opacity-80'"
            :style="{ backgroundColor: color }"
          />
        </div>
      </div>
    </div>

    <!-- Collection List -->
    <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
      <!-- Empty State -->
      <div v-if="collections.length === 0" class="flex flex-col items-center justify-center h-[200px] text-center px-4">
        <div class="w-12 h-12 mb-3 rounded-full bg-[var(--bg-base)] flex items-center justify-center c-[var(--text-tertiary)]">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p class="text-[13px] c-[var(--text-secondary)] mb-3">{{ t('collections.noCollections') }}</p>
        <button
          @click="showCreateInput = true"
          class="px-3 py-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] text-[12px] hover:bg-[var(--bg-base)] transition-colors"
        >
          {{ t('collections.createFirst') }}
        </button>
      </div>

      <div v-else class="space-y-0.5">
        <div
          v-for="collection in collections"
          :key="collection.id"
          draggable="true"
          @click="selectAndFetch(collection.id)"
          @dragstart="handleDragStart(collection.id)"
          @dragover="handleDragOver($event, collection.id)"
          @dragleave="handleDragLeave"
          @drop="handleDrop(collection.id)"
          class="group flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-all select-none border border-transparent"
          :class="[
            selectedId === collection.id
              ? 'bg-[rgba(255,122,24,0.1)] c-[var(--accent)] font-medium'
              : 'hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] c-[var(--text-primary)]',
            dragOverId === collection.id ? 'border-t-[var(--accent)]' : '',
            draggedId === collection.id ? 'opacity-50' : ''
          ]"
        >
          <!-- Edit Mode -->
          <template v-if="editingId === collection.id">
            <input
              v-model="editName"
              class="flex-1 min-w-0 px-1.5 py-0.5 text-[13px] rounded border border-[var(--accent)] bg-[var(--bg-base)] outline-none"
              @keyup.enter="handleEdit"
              @keyup.escape="editingId = null"
              @click.stop
              autoFocus
            />
            <button @click.stop="handleEdit" class="text-xs p-1 rounded hover:bg-[rgba(0,0,0,0.05)] c-[var(--accent)]">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </template>

          <!-- Normal Mode -->
          <template v-else>
            <!-- Icon -->
            <span 
              class="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-105 shrink-0"
              :class="{ 'opacity-100': selectedId === collection.id, 'opacity-70 group-hover:opacity-100': selectedId !== collection.id }"
            >
              <svg 
                class="w-4 h-4 fill-current" 
                :style="{ color: collection.color }" 
                viewBox="0 0 24 24" 
                stroke="none"
              >
                <path d="M20 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.17l1.42 1.42a2 2 0 0 0 1.41.58H20a2 2 0 0 1 2 2v10z"/>
              </svg>
            </span>

            <span class="flex-1 text-[13px] truncate leading-tight">{{ collection.name }}</span>
            
            <span 
              v-if="collection.entry_count" 
              class="text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 transition-colors"
              :class="selectedId === collection.id ? 'bg-[var(--accent)] text-white' : 'bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.1)] c-[var(--text-tertiary)]'"
            >
              {{ collection.entry_count }}
            </span>

            <!-- Actions -->
            <div class="hidden group-hover:flex items-center gap-0.5 ml-1 animate-fade-in">
              <button 
                @click.stop="startEdit(collection.id, collection.name)" 
                class="p-1 rounded opacity-60 hover:opacity-100 hover:bg-[rgba(0,0,0,0.05)] transition-all"
                :title="t('common.edit')"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button 
                @click.stop="handleDelete(collection.id)" 
                class="p-1 rounded opacity-60 hover:opacity-100 hover:bg-[rgba(255,59,48,0.1)] hover:c-[#ff3b30] transition-all"
                :title="t('common.delete')"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </aside>

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
