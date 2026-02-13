/**
 * Details Panel Composable
 *
 * Manages the details panel display mode (docked / drawer / fullscreen),
 * overlay visibility, body scroll locking, and back-to-top button.
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import type { Entry } from '../types'

export type DetailsPanelMode = 'docked' | 'click'
export type DetailsPresentation = 'docked' | 'drawer' | 'fullscreen'

const DETAILS_FULLSCREEN_BREAKPOINT = 960
const DETAILS_DRAWER_BREAKPOINT = 1200

export function useDetailsPanel(
  viewportWidth: Ref<number>,
  detailsWidth: Ref<number>,
  currentSelectedEntry: Ref<Entry | null>,
) {
  const settingsStore = useSettingsStore()

  const isDetailsOpen = ref(false)
  const timelineScroller = ref<HTMLElement | null>(null)
  const showBackToTop = ref(false)

  let previousBodyOverflow = ''
  let previousBodyPaddingRight = ''
  let bodyScrollLocked = false

  // === Computed ===

  const detailsPanelMode = computed<DetailsPanelMode>(() => {
    return settingsStore.settings.details_panel_mode === 'click' ? 'click' : 'docked'
  })

  const detailsPresentation = computed<DetailsPresentation>(() => {
    const width = viewportWidth.value
    if (width <= DETAILS_FULLSCREEN_BREAKPOINT) return 'fullscreen'
    if (width <= DETAILS_DRAWER_BREAKPOINT) return 'drawer'
    return detailsPanelMode.value === 'click' ? 'drawer' : 'docked'
  })

  const isSingleColumn = computed(() => viewportWidth.value <= DETAILS_FULLSCREEN_BREAKPOINT)

  const showDetailsOverlay = computed(() => {
    if (detailsPresentation.value === 'docked') return false
    return isDetailsOpen.value && !!currentSelectedEntry.value
  })

  const showBackToTopButton = computed(() => {
    return isSingleColumn.value && showBackToTop.value && !showDetailsOverlay.value
  })

  const detailsOverlayWidth = computed(() => {
    if (detailsPresentation.value === 'fullscreen') return '100vw'
    const maxWidth = Math.min(detailsWidth.value, Math.round(viewportWidth.value * 0.92))
    return `${maxWidth}px`
  })

  const detailsOverlayStyle = computed(() => ({
    width: detailsOverlayWidth.value,
    '--details-width': detailsOverlayWidth.value,
  }))

  // === Actions ===

  function openDetails() {
    if (detailsPresentation.value === 'docked') return
    isDetailsOpen.value = true
  }

  function closeDetails() {
    isDetailsOpen.value = false
  }

  function lockBodyScroll() {
    if (bodyScrollLocked || typeof document === 'undefined') return
    const body = document.body
    const root = document.documentElement
    if (!body || !root) return
    previousBodyOverflow = body.style.overflow
    previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - root.clientWidth
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }
    body.style.overflow = 'hidden'
    bodyScrollLocked = true
  }

  function unlockBodyScroll() {
    if (!bodyScrollLocked || typeof document === 'undefined') return
    const body = document.body
    if (!body) return
    body.style.overflow = previousBodyOverflow
    body.style.paddingRight = previousBodyPaddingRight
    bodyScrollLocked = false
  }

  function updateBackToTopVisibility() {
    if (typeof window === 'undefined') return
    const windowTop = window.scrollY || 0
    const scrollerTop = timelineScroller.value?.scrollTop ?? 0
    showBackToTop.value = Math.max(windowTop, scrollerTop) > 320
  }

  function scrollToTop() {
    timelineScroller.value?.scrollTo({ top: 0, behavior: 'smooth' })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // === Watchers ===

  watch(detailsPresentation, (presentation) => {
    if (presentation === 'docked') {
      isDetailsOpen.value = false
    }
  })

  watch(
    () => currentSelectedEntry.value,
    (entry) => {
      if (!entry) isDetailsOpen.value = false
    },
  )

  watch(
    () => showDetailsOverlay.value,
    (visible) => {
      if (visible) {
        lockBodyScroll()
      } else {
        unlockBodyScroll()
      }
    },
    { immediate: true },
  )

  // === Lifecycle ===

  function setupScrollListeners() {
    if (typeof window === 'undefined') return
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true })
    timelineScroller.value = document.querySelector('.timeline__list') as HTMLElement | null
    timelineScroller.value?.addEventListener('scroll', updateBackToTopVisibility, { passive: true })
    updateBackToTopVisibility()
  }

  function cleanupScrollListeners() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', updateBackToTopVisibility)
    }
    timelineScroller.value?.removeEventListener('scroll', updateBackToTopVisibility)
  }

  return {
    isDetailsOpen,
    timelineScroller,
    showBackToTop,
    detailsPanelMode,
    detailsPresentation,
    isSingleColumn,
    showDetailsOverlay,
    showBackToTopButton,
    detailsOverlayWidth,
    detailsOverlayStyle,

    openDetails,
    closeDetails,
    unlockBodyScroll,
    scrollToTop,
    setupScrollListeners,
    cleanupScrollListeners,
  }
}
