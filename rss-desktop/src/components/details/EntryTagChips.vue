<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore, type UserTag } from '../../stores/tagsStore'

const props = defineProps<{
  entryId: string
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()

const entryTags = ref<UserTag[]>([])
const loading = ref(false)
const showAddDropdown = ref(false)

// Load tags when entryId changes
watch(() => props.entryId, async (id) => {
  if (id) {
    loading.value = true
    entryTags.value = await tagsStore.getEntryTags(id)
    loading.value = false
  } else {
    entryTags.value = []
  }
}, { immediate: true })

// Tags available for adding (not already assigned)
const availableTags = computed(() => {
  const assignedIds = new Set(entryTags.value.map(t => t.id))
  return tagsStore.tags.filter(t => !assignedIds.has(t.id) && t.enabled === 1)
})

async function addTag(tagId: string) {
  await tagsStore.addTagToEntry(props.entryId, tagId)
  entryTags.value = await tagsStore.getEntryTags(props.entryId)
  showAddDropdown.value = false
}

async function removeTag(tagId: string) {
  await tagsStore.removeTagFromEntry(props.entryId, tagId)
  entryTags.value = entryTags.value.filter(t => t.id !== tagId)
}

function toggleDropdown() {
  if (!showAddDropdown.value) {
    // Ensure tags list is fresh
    tagsStore.fetchTags()
  }
  showAddDropdown.value = !showAddDropdown.value
}
</script>

<template>
  <div v-if="entryId" class="flex flex-wrap items-center gap-1.5 py-2">
    <!-- Existing tag chips -->
    <span
      v-for="tag in entryTags"
      :key="tag.id"
      class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg border transition-all"
      :style="{
        backgroundColor: tag.color + '18',
        borderColor: tag.color + '35',
        color: tag.color,
      }"
    >
      <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
      {{ tag.name }}
      <button
        @click.stop="removeTag(tag.id)"
        class="ml-0.5 p-0 opacity-60 hover:opacity-100 transition-opacity"
        :style="{ color: tag.color }"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </span>

    <!-- Add tag button -->
    <div class="relative">
      <button
        @click.stop="toggleDropdown"
        class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded-lg border border-dashed border-[var(--border-color)] c-[var(--text-tertiary)] hover:c-[var(--text-secondary)] hover:border-[rgba(139,92,246,0.3)] hover:bg-[rgba(139,92,246,0.05)] transition-all"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('tags.addTag') }}
      </button>

      <!-- Dropdown -->
      <div
        v-if="showAddDropdown"
        class="absolute top-full left-0 mt-1 z-50 min-w-40 max-h-48 overflow-y-auto rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-lg py-1"
      >
        <template v-if="availableTags.length > 0">
          <button
            v-for="tag in availableTags"
            :key="tag.id"
            @click="addTag(tag.id)"
            class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.06)] transition-colors c-[var(--text-primary)]"
          >
            <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
            {{ tag.name }}
          </button>
        </template>
        <div v-else class="px-3 py-2 text-[11px] c-[var(--text-tertiary)]">
          {{ t('tags.noTagsAvailable') }}
        </div>
      </div>
    </div>

    <!-- Click outside to close dropdown -->
    <Teleport to="body">
      <div
        v-if="showAddDropdown"
        class="fixed inset-0 z-40"
        @click="showAddDropdown = false"
      />
    </Teleport>
  </div>
</template>
