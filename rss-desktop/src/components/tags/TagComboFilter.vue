<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore } from '../../stores/tagsStore'

const emit = defineEmits<{
  (e: 'apply', tagIds: string[], mode: 'and' | 'or'): void
  (e: 'clear'): void
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()

const selectedTagIds = ref<Set<string>>(new Set())
const filterMode = ref<'and' | 'or'>('or')
const isActive = ref(false)

const tags = computed(() => tagsStore.tags.filter(t => t.enabled === 1))

function toggleTag(tagId: string) {
  if (selectedTagIds.value.has(tagId)) {
    selectedTagIds.value.delete(tagId)
  } else {
    selectedTagIds.value.add(tagId)
  }
  // Force reactivity
  selectedTagIds.value = new Set(selectedTagIds.value)
}

function applyFilter() {
  const ids = Array.from(selectedTagIds.value)
  if (ids.length > 0) {
    isActive.value = true
    emit('apply', ids, filterMode.value)
  }
}

function clearFilter() {
  selectedTagIds.value = new Set()
  isActive.value = false
  emit('clear')
}

</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-semibold c-[var(--text-tertiary)] uppercase tracking-wider">
        {{ t('tags.comboFilter') }}
      </span>
      <button
        v-if="isActive"
        @click="clearFilter"
        class="text-[10px] c-[var(--text-tertiary)] hover:c-[#ff3b30] transition-colors"
      >
        {{ t('tags.clearFilter') }}
      </button>
    </div>

    <!-- Mode toggle -->
    <div class="flex items-center gap-1.5">
      <button
        @click="filterMode = 'or'"
        class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-all border"
        :class="filterMode === 'or'
          ? 'bg-[rgba(249,115,22,0.15)] c-[#f97316] border-[rgba(249,115,22,0.3)]'
          : 'bg-transparent c-[var(--text-tertiary)] border-transparent hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
      >
        {{ t('tags.filterModeOr') }}
      </button>
      <button
        @click="filterMode = 'and'"
        class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-all border"
        :class="filterMode === 'and'
          ? 'bg-[rgba(59,130,246,0.15)] c-[#3b82f6] border-[rgba(59,130,246,0.3)]'
          : 'bg-transparent c-[var(--text-tertiary)] border-transparent hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
      >
        {{ t('tags.filterModeAnd') }}
      </button>
    </div>

    <!-- Tag pills -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="tag in tags"
        :key="tag.id"
        @click="toggleTag(tag.id)"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg border transition-all cursor-pointer"
        :class="selectedTagIds.has(tag.id)
          ? 'border-current shadow-sm'
          : 'border-[var(--border-color)] c-[var(--text-tertiary)] hover:border-current'"
        :style="selectedTagIds.has(tag.id)
          ? { backgroundColor: tag.color + '18', borderColor: tag.color + '50', color: tag.color }
          : {}"
      >
        <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: tag.color }"></span>
        {{ tag.name }}
      </button>
    </div>

    <!-- Apply button -->
    <button
      v-if="selectedTagIds.size > 0"
      @click="applyFilter"
      class="w-full px-3 py-1.5 text-[11px] font-medium rounded-lg bg-[rgba(139,92,246,0.1)] c-[#8b5cf6] border border-[rgba(139,92,246,0.2)] hover:bg-[rgba(139,92,246,0.18)] transition-all"
    >
      {{ t('tags.applyFilter') }} ({{ selectedTagIds.size }})
    </button>
  </div>
</template>
