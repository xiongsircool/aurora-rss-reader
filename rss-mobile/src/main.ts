import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { initData } from './data'

// Open the on-device database (and run migrations) before mounting so the
// first store access has a ready connection. Failures are logged but do not
// block the UI — stores surface their own errors.
initData()
  .then(async () => {
    // Dev-only: populate demo data for browser review (VITE_SEED_DEMO=1).
    if (import.meta.env.VITE_SEED_DEMO === '1') {
      const { seedDemoData } = await import('./data/devSeed')
      await seedDemoData()
    }
  })
  .catch((err) => console.error('[data] init failed', err))

createApp(App)
  .use(createPinia())
  .use(router)
  .mount('#app')
