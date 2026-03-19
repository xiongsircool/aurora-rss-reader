<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { RouterView } from 'vue-router'

const UpdateNotification = defineAsyncComponent(() => import('./components/UpdateNotification.vue'))
</script>

<template>
  <RouterView />
  <UpdateNotification />
</template>
