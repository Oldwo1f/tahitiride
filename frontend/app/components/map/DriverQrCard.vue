<script setup lang="ts">
import QRCode from 'qrcode'
import type { QrTokenResponse } from '~/types/api'

const api = useApi()
const token = ref<string | null>(null)
const svg = ref<string | null>(null)
const exp = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const res = await api<QrTokenResponse>('/api/qr/driver')
    token.value = res.token
    exp.value = res.exp
    svg.value = await QRCode.toString(res.token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260,
    })
  } catch (e: unknown) {
    const msg =
      (e as { data?: { message?: string } })?.data?.message ||
      (e as { message?: string })?.message ||
      'Impossible de générer le QR'
    error.value = msg
  } finally {
    loading.value = false
  }
}

const remaining = computed(() => {
  if (!exp.value) return 0
  return Math.max(0, exp.value - Math.floor(Date.now() / 1000))
})
const tick = ref(0)

onMounted(() => {
  refresh()
  timer = setInterval(() => {
    tick.value++
    if (remaining.value <= 1) {
      refresh()
    }
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <Card class="qr-card">
    <template #title>
      <div class="qr-title">
        <span>QR conducteur</span>
        <Tag v-if="remaining > 0" :value="`${remaining}s`" severity="info" />
      </div>
    </template>
    <template #content>
      <div v-if="error" class="tr-error">{{ error }}</div>
      <div v-else-if="svg" class="qr-svg" v-html="svg" />
      <div v-else class="tr-center"><ProgressSpinner /></div>
      <p class="tr-subtle" style="text-align: center; margin: 0.5rem 0 0;">
        Le passager scanne ce code au début et à la fin du trajet.
      </p>
    </template>
  </Card>
</template>

<style scoped>
.qr-card {
  width: 100%;
}
.qr-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}
.qr-svg {
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}
.qr-svg :deep(svg) {
  width: 220px;
  height: 220px;
  max-width: 60vw;
}
</style>
