import { ref } from 'vue'

export type NotificationType = 'success' | 'error' | 'info'

/**
 * Composable for managing toast notifications
 */
export function useNotification() {
    const showToast = ref(false)
    const toastMessage = ref('')
    const toastType = ref<NotificationType>('info')

    /**
     * Show a notification toast
     * @param message - The message to display
     * @param type - The type of notification (success, error, info)
     */
    function showNotification(message: string, type: NotificationType = 'info') {
        toastMessage.value = message
        toastType.value = type
        showToast.value = true
    }

    /**
     * Hide the current notification
     */
    function hideNotification() {
        showToast.value = false
    }

    return {
        showToast,
        toastMessage,
        toastType,
        showNotification,
        hideNotification
    }
}
