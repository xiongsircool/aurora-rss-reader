import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import RootApp from './App.vue'
import i18n, { availableLocales, type LocaleCode } from './i18n'

const app = createApp(RootApp)
const pinia = createPinia()

function bootstrapSavedLanguage() {
  if (typeof window === 'undefined') return
  const saved = localStorage.getItem('rss-reader-language') as LocaleCode | null
  if (saved && availableLocales.some(locale => locale.code === saved)) {
    i18n.global.locale.value = saved
  }
}

bootstrapSavedLanguage()

app.use(pinia)
app.use(router)
app.use(i18n)
app.mount('#app')
