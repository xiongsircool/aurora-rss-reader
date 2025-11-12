import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import i18n from './i18n'
import { useLanguage } from './composables/useLanguage'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// 在应用挂载后加载语言设置
app.mount('#app')

// 初始化语言设置
const { loadLanguage } = useLanguage()
loadLanguage()
