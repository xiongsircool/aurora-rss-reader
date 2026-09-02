import { createRouter, createWebHashHistory } from 'vue-router'
import InboxView from '../views/InboxView.vue'
import ReaderView from '../views/ReaderView.vue'
import SavedView from '../views/SavedView.vue'
import SettingsView from '../views/SettingsView.vue'
import SourcesView from '../views/SourcesView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'inbox', component: InboxView },
    { path: '/entries/:id', name: 'reader', component: ReaderView, props: true },
    { path: '/sources', name: 'sources', component: SourcesView },
    { path: '/saved', name: 'saved', component: SavedView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})
