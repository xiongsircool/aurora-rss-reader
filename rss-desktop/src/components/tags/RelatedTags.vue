<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore } from '../../stores/tagsStore'

const props = defineProps<{
  tagId: string
}>()

const emit = defineEmits<{
  (e: 'select-tag', tagId: string): void
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()

const relatedTags = ref<Array<{ id: string; name: string; color: string; overlap_count: number }>>([])
const loading = ref(false)

watch(() => props.tagId, async (id) => {
  if (id) {
    loading.value = true
    relatedTags.value = await tagsStore.fetchRelatedTags(id)
    loading.value = false
  } else {
    relatedTags.value = []
  }
}, { immediate: true })
</script>

<template>
  <div v-if="relatedTags.length > 0" class="mt-3">
    <div class="text-[10px] font-semibold c-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 px-1">
      {{ t('tags.relatedTags') }}
    </div>
    <div class="flex flex-wrap gap-1">
      <button
        v-for="tag in relatedTags"
        :key="tag.id"
        @click="emit('select-tag', tag.id)"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-lg border border-[var(--border-color)] bg-transparent c-[var(--text-secondary)] hover:border-current transition-all cursor-pointer"
        :style="{ '--hover-color': tag.color }"
        :title="t('tags.overlapCount', { count: tag.overlap_count })"
      >
        <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
        {{ tag.name }}
        <span class="text-[9px] c-[var(--text-tertiary)] tabular-nums">{{ tag.overlap_count }}</span>
      </button>
    </div>
  </div>
</template>
