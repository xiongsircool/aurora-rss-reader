import { createRouter, createWebHashHistory } from 'vue-router'
import AppHome from '../views/AppHome.vue'

const routes = [
  { path: '/', name: 'home', component: AppHome },
  {
    path: '/workspace',
    name: 'workspace',
    component: () => import('../views/WorkspaceView.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
