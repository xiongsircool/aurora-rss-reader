import { ref, onMounted, onUnmounted } from 'vue'

export interface ContextMenuPosition {
  x: number
  y: number
}

export function useContextMenu<T = any>() {
  const isOpen = ref(false)
  const position = ref<ContextMenuPosition>({ x: 0, y: 0 })
  const targetData = ref<T | null>(null)

  // Close all menus event
  const CLOSE_EVENT = 'context-menu:close-all'

  function open(e: MouseEvent, data: T) {
    e.preventDefault()
    e.stopPropagation()

    // Close other menus first
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT))

    // Calculate position (avoid overflow)
    const menuWidth = 220
    const menuHeight = 300
    const padding = 10
    let x = e.clientX
    let y = e.clientY

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding
    }

    x = Math.max(padding, x)
    y = Math.max(padding, y)

    position.value = { x, y }
    targetData.value = data

    requestAnimationFrame(() => {
      isOpen.value = true
    })
  }

  function close() {
    isOpen.value = false
    targetData.value = null
  }

  function handleCloseAll() {
    close()
  }

  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.context-menu')) {
      close()
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalClick)
    window.addEventListener(CLOSE_EVENT, handleCloseAll)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick)
    window.removeEventListener(CLOSE_EVENT, handleCloseAll)
  })

  return {
    isOpen,
    position,
    targetData,
    open,
    close,
  }
}
