<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore, type Collection } from '../../stores/collectionsStore'

const props = defineProps<{
  show: boolean
  entryId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'added'): void
}>()

const { t } = useI18n()
const collectionsStore = useCollectionsStore()

const showCreateForm = ref(false)
const newCollectionName = ref('')
const entryCollectionIds = ref<Set<string>>(new Set())
const loading = ref(false)

const collections = computed(() => collectionsStore.collections)

onMounted(async () => {
  await collectionsStore.fetchCollections()
  // Get collections this entry is already in
  const entryCollections = await collectionsStore.getCollectionsForEntry(props.entryId)
  entryCollectionIds.value = new Set(entryCollections.map(c => c.id))
})

async function handleAddToCollection(collection: Collection) {
  if (entryCollectionIds.value.has(collection.id)) return

  loading.value = true
  try {
    await collectionsStore.addEntryToCollection(collection.id, props.entryId)
    entryCollectionIds.value.add(collection.id)
    emit('added')
  } catch (e) {
    console.error('Failed to add to collection:', e)
  } finally {
    loading.value = false
  }
}

async function handleCreateCollection() {
  if (!newCollectionName.value.trim()) return

  loading.value = true
  try {
    const collection = await collectionsStore.createCollection(newCollectionName.value.trim())
    await collectionsStore.addEntryToCollection(collection.id, props.entryId)
    entryCollectionIds.value.add(collection.id)
    newCollectionName.value = ''
    showCreateForm.value = false
    emit('added')
  } catch (e) {
    console.error('Failed to create collection:', e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[10000] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>

      <!-- Modal -->
      <div class="relative bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-[340px] max-h-[80vh] overflow-hidden border border-[var(--border-color)]">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 class="font-semibold text-[15px]">{{ t('collections.addTo') }}</h3>
          <button @click="emit('close')" class="p-1 hover:bg-[rgba(0,0,0,0.05)] rounded-md">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-3 max-h-[300px] overflow-y-auto">
          <!-- Collection List -->
          <div v-if="collections.length > 0" class="space-y-1">
            <button
              v-for="collection in collections"
              :key="collection.id"
              @click="handleAddToCollection(collection)"
              :disabled="entryCollectionIds.has(collection.id)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
              :class="entryCollectionIds.has(collection.id)
                ? 'bg-[rgba(255,122,24,0.1)] c-[var(--accent)]'
                : 'hover:bg-[rgba(0,0,0,0.05)]'"
            >
              <span class="w-8 h-8 rounded-lg flex items-center justify-center" :style="{ backgroundColor: collection.color + '20' }">
                <svg class="w-4 h-4" :style="{ color: collection.color }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              <span class="flex-1 text-[13px]">{{ collection.name }}</span>
              <svg v-if="entryCollectionIds.has(collection.id)" class="w-4 h-4 c-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span v-else class="text-xs c-[var(--text-secondary)]">{{ collection.entry_count }}</span>
            </button>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-6 c-[var(--text-secondary)]">
            <p class="text-sm">{{ t('collections.noCollections') }}</p>
          </div>
        </div>

        <!-- Footer - Create New -->
        <div class="border-t border-[var(--border-color)] p-3">
          <div v-if="!showCreateForm">
            <button
              @click="showCreateForm = true"
              class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[13px] c-[var(--accent)] hover:bg-[rgba(255,122,24,0.1)] transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {{ t('collections.create') }}
            </button>
          </div>
          <div v-else class="flex gap-2">
            <input
              v-model="newCollectionName"
              :placeholder="t('collections.namePlaceholder')"
              class="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-transparent text-[13px] focus:border-[var(--accent)] outline-none"
              @keyup.enter="handleCreateCollection"
            />
            <button
              @click="handleCreateCollection"
              :disabled="!newCollectionName.trim() || loading"
              class="px-4 py-2 rounded-lg bg-[var(--accent)] c-white text-[13px] font-medium disabled:opacity-50"
            >
              {{ t('common.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
