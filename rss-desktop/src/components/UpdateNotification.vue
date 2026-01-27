<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { UpdateInfo } from '../types/electron'

const isVisible = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const downloadProgress = ref(0)
const isDownloading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

let unsubscribers: (() => void)[] = []

onMounted(() => {
  if (!window.electron) return

  // 监听下载开始
  const unsubDownloadStarted = window.electron.onUpdateDownloadStarted((info) => {
    isDownloading.value = true
    updateInfo.value = info
    downloadProgress.value = 0
  })

  // 监听下载进度
  const unsubDownloadProgress = window.electron.onUpdateDownloadProgress((progress) => {
    downloadProgress.value = progress.percent
  })

  // 监听下载完成
  const unsubDownloadCompleted = window.electron.onUpdateDownloadCompleted(() => {
    isDownloading.value = false
    isVisible.value = false
    downloadProgress.value = 0
  })

  // 监听错误
  const unsubError = window.electron.onUpdateError((error) => {
    hasError.value = true
    errorMessage.value = error.message
    isDownloading.value = false
    setTimeout(() => {
      hasError.value = false
      isVisible.value = false
    }, 5000)
  })

  unsubscribers.push(
    unsubDownloadStarted,
    unsubDownloadProgress,
    unsubDownloadCompleted,
    unsubError
  )
})

onUnmounted(() => {
  unsubscribers.forEach((unsub) => unsub())
})

function closeNotification() {
  isVisible.value = false
}
</script>

<template>
  <!-- 下载进度提示 -->
  <transition name="slide-down">
    <div v-if="isDownloading" class="update-notification">
      <div class="notification-content">
        <div class="notification-icon">
          <div class="i-carbon-download" />
        </div>
        <div class="notification-body">
          <div class="notification-title">正在下载更新</div>
          <div class="notification-message">
            版本 {{ updateInfo?.version }} - {{ downloadProgress.toFixed(1) }}%
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${downloadProgress}%` }" />
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- 错误提示 -->
  <transition name="slide-down">
    <div v-if="hasError" class="update-notification error">
      <div class="notification-content">
        <div class="notification-icon error">
          <div class="i-carbon-warning" />
        </div>
        <div class="notification-body">
          <div class="notification-title">更新失败</div>
          <div class="notification-message">{{ errorMessage }}</div>
        </div>
        <button class="close-btn" @click="closeNotification">
          <div class="i-carbon-close" />
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.update-notification {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  min-width: 320px;
  max-width: 400px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.update-notification.error {
  border-color: var(--color-error);
}

.notification-content {
  display: flex;
  gap: 12px;
  padding: 16px;
  align-items: flex-start;
}

.notification-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  font-size: 24px;
}

.notification-icon.error {
  color: var(--color-error);
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-bg-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.close-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

/* 动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
