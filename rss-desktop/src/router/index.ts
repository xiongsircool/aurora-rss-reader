import { createRouter, createWebHashHistory } from 'vue-router'
import AppHome from '../views/AppHome.vue'

const routes = [
  { path: '/', name: 'home', component: AppHome },
  // Redirect old workspace route to home
  { path: '/workspace', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
