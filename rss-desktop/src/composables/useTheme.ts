import { ref } from 'vue'

/**
 * Composable for managing dark/light theme switching and persistence
 */
export function useTheme() {
    const darkMode = ref(false)

    /**
     * Toggle between dark and light mode
     */
    function toggleTheme() {
        darkMode.value = !darkMode.value
        updateTheme()
    }

    /**
     * Apply the current theme to the document
     */
    function updateTheme() {
        if (darkMode.value) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }

    /**
     * Load the theme from localStorage
     */
    function loadTheme() {
        if (typeof window === 'undefined') return
        const savedTheme = localStorage.getItem('theme')
        darkMode.value = savedTheme === 'dark'
        updateTheme()
    }

    return {
        darkMode,
        toggleTheme,
        updateTheme,
        loadTheme
    }
}
