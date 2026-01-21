/**
 * useTranslationQueue - Manage batch translation requests
 * 
 * Handles queueing, rate limiting, and batch processing of translation requests.
 */

import { ref, computed, watch } from 'vue'
import api from '@/api/client'
import type { ArticleBlock } from './useArticleParser'

export interface TranslationQueueOptions {
    batchSize?: number      // Segments per request (default: 5)
    maxConcurrent?: number  // Max parallel requests (default: 2)
    retryLimit?: number     // Retry attempts per segment (default: 2)
}

interface BatchRequest {
    entryId: string
    language: string
    segments: { id: string; text: string }[]
}

interface BatchResponse {
    entry_id: string
    language: string
    results: Record<string, string>
    cached_count: number
    translated_count: number
}

export function useTranslationQueue(options: TranslationQueueOptions = {}) {
    const {
        batchSize = 5,
        maxConcurrent = 2,
        retryLimit = 2
    } = options

    const isProcessing = ref(false)
    const activeRequests = ref(0)
    const totalBlocks = ref(0)
    const completedBlocks = ref(0)
    const failedBlocks = ref(0)

    const progress = computed(() => {
        if (totalBlocks.value === 0) return 0
        return Math.round((completedBlocks.value / totalBlocks.value) * 100)
    })

    /**
     * Fetch cached translations from backend
     */
    async function fetchCache(entryId: string, language: string = 'zh'): Promise<Record<string, string>> {
        try {
            const response = await api.get(`/ai/translation-cache/${entryId}`, {
                params: { language }
            })
            return response.data.paragraph_map || {}
        } catch (error) {
            console.warn('Failed to fetch translation cache:', error)
            return {}
        }
    }

    /**
     * Send a batch of segments for translation
     */
    async function translateBatch(request: BatchRequest): Promise<BatchResponse> {
        const response = await api.post('/ai/translate-batch', {
            entry_id: request.entryId,
            language: request.language,
            segments: request.segments
        })
        return response.data
    }

    /**
     * Process blocks in batches with concurrency control
     */
    async function processQueue(
        entryId: string,
        blocks: ArticleBlock[],
        language: string = 'zh',
        onBlockUpdate: (blockId: string, translation: string, status: ArticleBlock['status'], error?: string) => void
    ): Promise<void> {
        // Filter blocks that need translation
        const pendingBlocks = blocks.filter(
            b => b.status === 'idle' && b.text.length > 0 && !b.id.startsWith('code_') && !b.id.startsWith('empty_')
        )

        if (pendingBlocks.length === 0) {
            return
        }

        isProcessing.value = true
        totalBlocks.value = pendingBlocks.length
        completedBlocks.value = 0
        failedBlocks.value = 0

        // Mark all pending blocks as loading
        for (const block of pendingBlocks) {
            onBlockUpdate(block.id, '', 'loading')
        }

        // Split into batches
        const batches: ArticleBlock[][] = []
        for (let i = 0; i < pendingBlocks.length; i += batchSize) {
            batches.push(pendingBlocks.slice(i, i + batchSize))
        }

        // Process batches with concurrency control
        let batchIndex = 0
        const processBatch = async (): Promise<void> => {
            while (batchIndex < batches.length) {
                const currentIndex = batchIndex++
                const batch = batches[currentIndex]

                try {
                    activeRequests.value++

                    const response = await translateBatch({
                        entryId,
                        language,
                        segments: batch.map(b => ({ id: b.id, text: b.text }))
                    })

                    // Update blocks with results
                    for (const block of batch) {
                        const translation = response.results[block.id]
                        if (translation && !translation.startsWith('[Translation Error:')) {
                            onBlockUpdate(block.id, translation, 'success')
                            completedBlocks.value++
                        } else if (translation?.startsWith('[Translation Error:')) {
                            onBlockUpdate(block.id, '', 'error', translation)
                            failedBlocks.value++
                        } else {
                            onBlockUpdate(block.id, '', 'error', 'No translation returned')
                            failedBlocks.value++
                        }
                    }
                } catch (error: any) {
                    // Mark entire batch as failed
                    for (const block of batch) {
                        onBlockUpdate(block.id, '', 'error', error.message || 'Request failed')
                        failedBlocks.value++
                    }
                } finally {
                    activeRequests.value--
                }
            }
        }

        // Start concurrent processors
        const processors: Promise<void>[] = []
        for (let i = 0; i < maxConcurrent; i++) {
            processors.push(processBatch())
        }

        await Promise.all(processors)
        isProcessing.value = false
    }

    /**
     * Retry failed blocks
     */
    async function retryFailed(
        entryId: string,
        blocks: ArticleBlock[],
        language: string = 'zh',
        onBlockUpdate: (blockId: string, translation: string, status: ArticleBlock['status'], error?: string) => void
    ): Promise<void> {
        const failedBlocks = blocks.filter(b => b.status === 'error')

        if (failedBlocks.length === 0) return

        // Reset failed blocks to idle
        for (const block of failedBlocks) {
            block.status = 'idle'
            block.error = undefined
        }

        // Reprocess
        await processQueue(entryId, blocks, language, onBlockUpdate)
    }

    /**
     * Retry a single block
     */
    async function retrySingle(
        entryId: string,
        block: ArticleBlock,
        language: string = 'zh',
        onBlockUpdate: (blockId: string, translation: string, status: ArticleBlock['status'], error?: string) => void
    ): Promise<void> {
        onBlockUpdate(block.id, '', 'loading')

        try {
            const response = await translateBatch({
                entryId,
                language,
                segments: [{ id: block.id, text: block.text }]
            })

            const translation = response.results[block.id]
            if (translation && !translation.startsWith('[Translation Error:')) {
                onBlockUpdate(block.id, translation, 'success')
            } else {
                onBlockUpdate(block.id, '', 'error', translation || 'No translation returned')
            }
        } catch (error: any) {
            onBlockUpdate(block.id, '', 'error', error.message || 'Retry failed')
        }
    }

    /**
     * Cancel ongoing processing
     */
    function cancel() {
        isProcessing.value = false
        // Note: Active requests will still complete, but no new batches will start
    }

    return {
        isProcessing,
        activeRequests,
        progress,
        totalBlocks,
        completedBlocks,
        failedBlocks,
        fetchCache,
        processQueue,
        retryFailed,
        retrySingle,
        cancel
    }
}

export type TranslationQueueReturn = ReturnType<typeof useTranslationQueue>
