import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export function useConfirmDialog() {
  const show = ref(false)
  const options = ref<ConfirmOptions>({ message: '' })
  let resolver: ((value: boolean) => void) | null = null

  function requestConfirm(nextOptions: ConfirmOptions): Promise<boolean> {
    options.value = nextOptions
    show.value = true
    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  function handleConfirm() {
    show.value = false
    resolver?.(true)
    resolver = null
  }

  function handleCancel() {
    show.value = false
    resolver?.(false)
    resolver = null
  }

  return {
    show,
    options,
    requestConfirm,
    handleConfirm,
    handleCancel
  }
}
