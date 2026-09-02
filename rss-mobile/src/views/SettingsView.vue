<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import { MonitorSmartphone, Sparkles } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settingsStore'

const settings = useSettingsStore()
const form = reactive({ base_url: '', api_key: '', model: '', prompt: '' })

onMounted(async () => {
  await settings.load()
})

watch(
  () => settings.ai,
  (ai) => {
    form.base_url = ai.base_url
    form.api_key = ai.api_key
    form.model = ai.model
    form.prompt = ai.prompt
  },
  { immediate: true, deep: true },
)

async function saveAi() {
  await settings.saveAi({ ...form })
}
</script>

<template>
  <main class="screen">
    <header class="screen-header">
      <div>
        <p class="eyebrow">Mobile</p>
        <h1>Settings</h1>
      </div>
    </header>

    <section class="settings-card">
      <div class="settings-card__icon">
        <Sparkles :size="20" />
      </div>
      <div class="settings-card__body">
        <h2>AI (summaries &amp; translation)</h2>
        <p>Connect any OpenAI-compatible endpoint. Used on-device for summaries and translation; results are cached locally.</p>
        <input v-model="form.base_url" type="url" inputmode="url" placeholder="https://open.bigmodel.cn/api/paas/v4/">
        <input v-model="form.api_key" type="password" placeholder="API key">
        <input v-model="form.model" type="text" placeholder="glm-4-flash">
        <textarea v-model="form.prompt" rows="2" placeholder="Optional custom instruction for summaries"></textarea>
        <div class="settings-actions">
          <button class="primary-button" type="button" @click="saveAi">Save</button>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card__icon">
        <MonitorSmartphone :size="20" />
      </div>
      <div class="settings-card__body">
        <h2>Mobile scope</h2>
        <p>Aurora mobile is fully standalone — it fetches feeds, stores articles, and runs AI on your device with no backend. Desktop-only MCP and advanced AI workflows stay out of the mobile UI.</p>
      </div>
    </section>
  </main>
</template>
