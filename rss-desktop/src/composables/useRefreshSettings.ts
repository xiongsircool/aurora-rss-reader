import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'

const FETCH_INTERVAL_MIN = 5
const FETCH_INTERVAL_MAX = 1440

export function useRefreshSettings() {
    const { t } = useI18n()
    const settingsStore = useSettingsStore()

    const fetchIntervalInput = ref<number | null>(settingsStore.settings.fetch_interval_minutes)
    const fetchIntervalError = ref('')

    // Watch for valid input to clear error
    watch(fetchIntervalInput, (value) => {
        if (value !== null && !Number.isNaN(value) && value >= FETCH_INTERVAL_MIN && value <= FETCH_INTERVAL_MAX) {
            fetchIntervalError.value = ''
        }
    })

    // Watch store changes
    watch(() => settingsStore.settings.fetch_interval_minutes, (newValue) => {
        if (typeof newValue === 'number') {
            fetchIntervalInput.value = newValue
        }
    })

    function validateFetchInterval(value: number | null): number | null {
        if (value === null || Number.isNaN(value)) {
            fetchIntervalError.value = t('settings.refreshIntervalErrorRequired')
            return null
        }

        if (value < FETCH_INTERVAL_MIN || value > FETCH_INTERVAL_MAX) {
            fetchIntervalError.value = t('settings.refreshIntervalErrorRange', {
                min: FETCH_INTERVAL_MIN,
                max: FETCH_INTERVAL_MAX
            })
            return null
        }

        fetchIntervalError.value = ''
        return value
    }

    async function commitFetchInterval(): Promise<boolean> {
        const validValue = validateFetchInterval(fetchIntervalInput.value)
        if (validValue === null) {
            return false
        }

        if (validValue === settingsStore.settings.fetch_interval_minutes) {
            return true
        }

        try {
            await settingsStore.updateSettings({ fetch_interval_minutes: validValue })
            return true
        } catch (error) {
            console.error('刷新间隔保存失败', error)
            fetchIntervalError.value = t('settings.refreshIntervalErrorSubmit')
            return false
        }
    }

    async function handleFetchIntervalChange() {
        await commitFetchInterval()
    }

    function syncFromStore() {
        fetchIntervalInput.value = settingsStore.settings.fetch_interval_minutes
    }

    return {
        fetchIntervalInput,
        fetchIntervalError,
        FETCH_INTERVAL_MIN,
        FETCH_INTERVAL_MAX,
        validateFetchInterval,
        commitFetchInterval,
        handleFetchIntervalChange,
        syncFromStore
    }
}
