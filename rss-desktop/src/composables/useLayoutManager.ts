import { ref, computed } from 'vue'

const DEFAULT_VIEWPORT_WIDTH = typeof window !== 'undefined' ? window.innerWidth : 1440
const DEFAULT_SIDEBAR_RATIO = 0.26
const DEFAULT_DETAILS_RATIO = 0.38
const MIN_TIMELINE_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 180
const MIN_DETAILS_WIDTH = 260
const SIDEBAR_RATIO_KEY = 'rss-layout-sidebar-ratio'
const DETAILS_RATIO_KEY = 'rss-layout-details-ratio'

/**
 * Composable for managing three-column layout with resizable panels
 */
export function useLayoutManager() {
    const sidebarRatio = ref(DEFAULT_SIDEBAR_RATIO)
    const detailsRatio = ref(DEFAULT_DETAILS_RATIO)
    const viewportWidth = ref(DEFAULT_VIEWPORT_WIDTH)
    const isDraggingLeft = ref(false)
    const isDraggingRight = ref(false)

    function getViewport(): number {
        return viewportWidth.value || DEFAULT_VIEWPORT_WIDTH
    }

    const sidebarWidth = computed(() => Math.round(getViewport() * sidebarRatio.value))
    const detailsWidth = computed(() => Math.round(getViewport() * detailsRatio.value))

    const logoSize = computed(() => {
        const width = sidebarWidth.value || MIN_SIDEBAR_WIDTH
        return Math.min(44, Math.max(30, width * 0.12))
    })

    const layoutStyle = computed(() => ({
        '--sidebar-width': `${sidebarWidth.value}px`,
        '--details-width': `${detailsWidth.value}px`,
    }))

    function minSidebarRatio(): number {
        return MIN_SIDEBAR_WIDTH / getViewport()
    }

    function minDetailsRatio(): number {
        return MIN_DETAILS_WIDTH / getViewport()
    }

    function minTimelineRatio(): number {
        return MIN_TIMELINE_WIDTH / getViewport()
    }

    function refreshViewportWidth() {
        if (typeof window === 'undefined') return
        viewportWidth.value = window.innerWidth
    }

    function normalizeRatios() {
        const sidebarMin = minSidebarRatio()
        const detailsMin = minDetailsRatio()
        const timelineMin = minTimelineRatio()
        sidebarRatio.value = Math.max(sidebarRatio.value, sidebarMin)
        detailsRatio.value = Math.max(detailsRatio.value, detailsMin)

        const maxSum = Math.max(0, 1 - timelineMin)
        let currentSum = sidebarRatio.value + detailsRatio.value

        if (maxSum <= 0) {
            const base = sidebarMin + detailsMin || 0.0001
            const scale = base / Math.max(currentSum, 0.0001)
            sidebarRatio.value = sidebarRatio.value * scale
            detailsRatio.value = detailsRatio.value * scale
            return
        }

        if (currentSum > maxSum) {
            const excess = currentSum - maxSum
            const sidebarShare = sidebarRatio.value / currentSum
            const detailsShare = detailsRatio.value / currentSum
            sidebarRatio.value = Math.max(sidebarMin, sidebarRatio.value - excess * sidebarShare)
            detailsRatio.value = Math.max(detailsMin, detailsRatio.value - excess * detailsShare)
            currentSum = sidebarRatio.value + detailsRatio.value
            if (currentSum > maxSum) {
                const scale = maxSum / currentSum
                sidebarRatio.value = Math.max(sidebarMin, sidebarRatio.value * scale)
                detailsRatio.value = Math.max(detailsMin, detailsRatio.value * scale)
            }
        }
    }

    function saveLayoutSettings() {
        localStorage.setItem(SIDEBAR_RATIO_KEY, sidebarRatio.value.toString())
        localStorage.setItem(DETAILS_RATIO_KEY, detailsRatio.value.toString())
    }

    function loadLayoutSettings() {
        if (typeof window === 'undefined') return
        refreshViewportWidth()
        const savedSidebarRatio = localStorage.getItem(SIDEBAR_RATIO_KEY)
        const savedDetailsRatio = localStorage.getItem(DETAILS_RATIO_KEY)

        if (savedSidebarRatio) {
            const ratio = parseFloat(savedSidebarRatio)
            if (!Number.isNaN(ratio)) {
                sidebarRatio.value = ratio
            }
        }
        if (savedDetailsRatio) {
            const ratio = parseFloat(savedDetailsRatio)
            if (!Number.isNaN(ratio)) {
                detailsRatio.value = ratio
            }
        }

        normalizeRatios()
    }

    function resetLayout() {
        sidebarRatio.value = DEFAULT_SIDEBAR_RATIO
        detailsRatio.value = DEFAULT_DETAILS_RATIO
        normalizeRatios()
        saveLayoutSettings()
    }

    function setSidebarRatioFromClientX(clientX: number) {
        refreshViewportWidth()
        const viewport = getViewport()
        const ratio = clientX / viewport
        sidebarRatio.value = ratio
        normalizeRatios()
        saveLayoutSettings()
    }

    function setDetailsRatioFromClientX(clientX: number) {
        refreshViewportWidth()
        const viewport = getViewport()
        const ratio = (viewport - clientX) / viewport
        detailsRatio.value = ratio
        normalizeRatios()
        saveLayoutSettings()
    }

    function handleWindowResize() {
        refreshViewportWidth()
        normalizeRatios()
        saveLayoutSettings()
    }

    // Drag handlers
    function handleMouseDownLeft(event: MouseEvent) {
        isDraggingLeft.value = true
        event.preventDefault()
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    function handleMouseDownRight(event: MouseEvent) {
        isDraggingRight.value = true
        event.preventDefault()
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    function handleMouseMove(event: MouseEvent) {
        if (isDraggingLeft.value) {
            setSidebarRatioFromClientX(event.clientX)
        } else if (isDraggingRight.value) {
            setDetailsRatioFromClientX(event.clientX)
        }
    }

    function handleMouseUp() {
        if (isDraggingLeft.value || isDraggingRight.value) {
            isDraggingLeft.value = false
            isDraggingRight.value = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }

    /**
     * Initialize layout manager with event listeners
     * Call this in onMounted
     */
    function initLayout() {
        refreshViewportWidth()
        loadLayoutSettings()
        normalizeRatios()
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('resize', handleWindowResize)
    }

    /**
     * Cleanup event listeners
     * Call this in onUnmounted
     */
    function cleanupLayout() {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('resize', handleWindowResize)
    }

    return {
        // State
        sidebarRatio,
        detailsRatio,
        viewportWidth,
        isDraggingLeft,
        isDraggingRight,

        // Computed
        sidebarWidth,
        detailsWidth,
        logoSize,
        layoutStyle,

        // Methods
        refreshViewportWidth,
        normalizeRatios,
        saveLayoutSettings,
        loadLayoutSettings,
        resetLayout,
        setSidebarRatioFromClientX,
        setDetailsRatioFromClientX,
        handleWindowResize,
        handleMouseDownLeft,
        handleMouseDownRight,
        handleMouseMove,
        handleMouseUp,
        initLayout,
        cleanupLayout
    }
}
