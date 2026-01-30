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
    const autoRefresh = ref(settingsStore.settings.auto_refresh)

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
    watch(() => settingsStore.settings.auto_refresh, (newValue) => {
        if (typeof newValue === 'boolean') {
            autoRefresh.value = newValue
        }
    })

    watch(autoRefresh, (value) => {
        if (!value) {
            fetchIntervalError.value = ''
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
        if (!autoRefresh.value) {
            fetchIntervalError.value = ''
            return true
        }
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

    async function commitAutoRefresh(): Promise<boolean> {
        if (autoRefresh.value === settingsStore.settings.auto_refresh) {
            return true
        }

        try {
            await settingsStore.updateSettings({ auto_refresh: autoRefresh.value })
            return true
        } catch (error) {
            console.error('自动刷新设置保存失败', error)
            autoRefresh.value = settingsStore.settings.auto_refresh
            return false
        }
    }

    async function handleFetchIntervalChange() {
        await commitFetchInterval()
    }

    async function handleAutoRefreshChange() {
        await commitAutoRefresh()
    }

    function syncFromStore() {
        fetchIntervalInput.value = settingsStore.settings.fetch_interval_minutes
        autoRefresh.value = settingsStore.settings.auto_refresh
    }

    return {
        fetchIntervalInput,
        fetchIntervalError,
        autoRefresh,
        FETCH_INTERVAL_MIN,
        FETCH_INTERVAL_MAX,
        validateFetchInterval,
        commitFetchInterval,
        commitAutoRefresh,
        handleFetchIntervalChange,
        handleAutoRefreshChange,
        syncFromStore
    }
}
