<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '../../stores/collectionsStore'

const { t } = useI18n()
const collectionsStore = useCollectionsStore()

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
  if (confirm(t('collections.deleteConfirm'))) {
    await collectionsStore.deleteCollection(id)
  }
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
  <aside class="h-full border-r border-[var(--border-color)] bg-[var(--bg-base)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
      <h2 class="font-semibold text-[15px]">{{ t('collections.title') }}</h2>
      <button
        @click="showCreateInput = !showCreateInput"
        class="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)]"
        :title="t('collections.create')"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- Create Input -->
    <div v-if="showCreateInput" class="px-3 py-3 border-b border-[var(--border-color)]">
      <div class="flex gap-2 mb-2">
        <input
          v-model="newName"
          :placeholder="t('collections.namePlaceholder')"
          class="flex-1 px-2 py-1.5 text-[13px] rounded border border-[var(--border-color)] bg-transparent focus:border-[var(--accent)] outline-none"
          @keyup.enter="handleCreate"
        />
        <button
          @click="handleCreate"
          :disabled="!newName.trim()"
          class="px-3 py-1.5 text-[12px] rounded bg-[var(--accent)] c-white disabled:opacity-50"
        >
          {{ t('common.add') }}
        </button>
      </div>
      <!-- Color Picker -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs c-[var(--text-secondary)] mr-1">{{ t('collections.color') }}:</span>
        <button
          v-for="color in presetColors"
          :key="color"
          @click="newColor = color"
          class="w-5 h-5 rounded-full transition-transform hover:scale-110"
          :class="newColor === color ? 'ring-2 ring-offset-1 ring-[var(--accent)]' : ''"
          :style="{ backgroundColor: color }"
        />
      </div>
    </div>

    <!-- Collection List -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Empty State with Guide -->
      <div v-if="collections.length === 0" class="flex flex-col items-center justify-center h-full text-center px-4">
        <svg class="w-16 h-16 mb-4 c-[var(--text-secondary)] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        <p class="text-sm c-[var(--text-secondary)] mb-3">{{ t('collections.noCollections') }}</p>
        <button
          @click="showCreateInput = true"
          class="px-4 py-2 rounded-lg bg-[var(--accent)] c-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {{ t('collections.createFirst') }}
        </button>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="collection in collections"
          :key="collection.id"
          draggable="true"
          @click="selectAndFetch(collection.id)"
          @dragstart="handleDragStart(collection.id)"
          @dragover="handleDragOver($event, collection.id)"
          @dragleave="handleDragLeave"
          @drop="handleDrop(collection.id)"
          class="group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
          :class="[
            selectedId === collection.id
              ? 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)]'
              : 'hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]',
            dragOverId === collection.id ? 'border-t-2 border-[var(--accent)]' : '',
            draggedId === collection.id ? 'opacity-50' : ''
          ]"
        >
          <!-- Edit Mode -->
          <template v-if="editingId === collection.id">
            <input
              v-model="editName"
              class="flex-1 px-2 py-1 text-[13px] rounded border border-[var(--border-color)] bg-transparent"
              @keyup.enter="handleEdit"
              @keyup.escape="editingId = null"
              @click.stop
            />
            <button @click.stop="handleEdit" class="text-xs c-[var(--accent)]">{{ t('common.save') }}</button>
          </template>

          <!-- Normal Mode -->
          <template v-else>
            <span class="w-7 h-7 rounded flex items-center justify-center" :style="{ backgroundColor: collection.color + '20' }">
              <svg class="w-4 h-4" :style="{ color: collection.color }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <span class="flex-1 text-[13px] truncate">{{ collection.name }}</span>
            <span class="text-xs c-[var(--text-secondary)]">{{ collection.entry_count }}</span>

            <!-- Actions -->
            <div class="hidden group-hover:flex items-center gap-1">
              <button @click.stop="startEdit(collection.id, collection.name)" class="p-1 rounded hover:bg-[rgba(0,0,0,0.1)]">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button @click.stop="handleDelete(collection.id)" class="p-1 rounded hover:bg-[rgba(255,0,0,0.1)] c-red-500">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </aside>
</template>
