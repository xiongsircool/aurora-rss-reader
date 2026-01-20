import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import 'virtual:uno.css'
import './style.css'
import App from './App.vue'
import i18n, { availableLocales, type LocaleCode } from './i18n'
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(App)
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
app.use(VueVirtualScroller)
app.mount('#app')
