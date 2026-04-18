<script setup lang="ts">
import QrScanner from 'qr-scanner'

const emit = defineEmits<{
  decoded: [value: string]
  error: [message: string]
}>()

const video = ref<HTMLVideoElement | null>(null)
let scanner: QrScanner | null = null
const starting = ref(true)
const errorMsg = ref<string | null>(null)
let lastValue: string | null = null
let lastAt = 0

onMounted(async () => {
  if (!video.value) return
  try {
    scanner = new QrScanner(
      video.value,
      (result) => {
        const value = typeof result === 'string' ? result : result.data
        const now = Date.now()
        if (value === lastValue && now - lastAt < 2000) return
        lastValue = value
        lastAt = now
        emit('decoded', value)
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment',
      },
    )
    await scanner.start()
    starting.value = false
  } catch (e: unknown) {
    const msg =
      (e as { message?: string })?.message || "Impossible d'accéder à la caméra"
    errorMsg.value = msg
    emit('error', msg)
    starting.value = false
  }
})

onBeforeUnmount(() => {
  scanner?.stop()
  scanner?.destroy()
  scanner = null
})
</script>

<template>
  <div class="qr-scanner">
    <div v-if="errorMsg" class="tr-error" style="padding: 1rem;">
      {{ errorMsg }}
    </div>
    <video v-else ref="video" playsinline muted />
    <div v-if="starting" class="scanner-loading">
      <ProgressSpinner />
    </div>
  </div>
</template>

<style scoped>
.qr-scanner {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}
video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.scanner-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}
</style>
