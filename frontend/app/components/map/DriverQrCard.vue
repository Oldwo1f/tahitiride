<script setup lang="ts">
import QRCode from 'qrcode'
import type { QrTokenResponse } from '~/types/api'

const api = useApi()
const token = ref<string | null>(null)
const plate = ref<string | null>(null)
const svg = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function loadQr() {
  loading.value = true
  error.value = null
  try {
    const res = await api<QrTokenResponse>('/api/qr/driver')
    token.value = res.token
    plate.value = res.plate
    svg.value = await QRCode.toString(res.token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
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

/**
 * Open a minimal printable HTML document containing only the QR + plate, so
 * the driver can print and stick it inside the vehicle. We deliberately
 * avoid touching the main app's CSS to keep this self-contained.
 */
function printQr() {
  if (!svg.value) return
  const win = window.open('', '_blank', 'width=480,height=640')
  if (!win) return
  const safePlate = (plate.value ?? '').replace(/[<>&"]/g, '')
  win.document.write(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>QR Kartiki${safePlate ? ` · ${safePlate}` : ''}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .sheet {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        padding: 28px 24px;
        min-height: 100vh;
      }
      .brand { font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; }
      .title { font-size: 22px; font-weight: 700; margin: 0; text-align: center; }
      .qr { padding: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }
      .qr svg { display: block; width: 320px; height: 320px; max-width: 80vmin; max-height: 80vmin; }
      .plate { font-size: 20px; font-weight: 600; letter-spacing: 0.06em; padding: 6px 16px; border: 2px solid #111; border-radius: 6px; }
      .hint { font-size: 12px; color: #64748b; text-align: center; max-width: 320px; line-height: 1.4; }
      @media print {
        @page { margin: 12mm; }
        .no-print { display: none !important; }
      }
      .actions { display: flex; gap: 8px; margin-top: 8px; }
      button { padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; font-size: 14px; }
      button.primary { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="brand">Kartiki</div>
      <h1 class="title">Scannez ce code pour démarrer&nbsp;/ terminer le trajet</h1>
      <div class="qr">${svg.value}</div>
      ${safePlate ? `<div class="plate">${safePlate}</div>` : ''}
      <p class="hint">Le passager scanne ce QR au début et à la fin de la course pour confirmer la prise en charge et le règlement.</p>
      <div class="actions no-print">
        <button class="primary" onclick="window.print()">Imprimer</button>
        <button onclick="window.close()">Fermer</button>
      </div>
    </div>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));<\/script>
  </body>
</html>`)
  win.document.close()
}

onMounted(loadQr)
</script>

<template>
  <Card class="qr-card">
    <template #title>
      <div class="qr-title">
        <span>QR conducteur</span>
        <Tag v-if="plate" :value="plate" severity="secondary" />
      </div>
    </template>
    <template #content>
      <div v-if="error" class="tr-error">{{ error }}</div>
      <div v-else-if="svg" class="qr-svg" v-html="svg" />
      <div v-else class="tr-center"><ProgressSpinner /></div>
      <p class="tr-subtle qr-hint">
        Code permanent : imprimez-le et collez-le dans votre véhicule. Le
        passager le scanne au début et à la fin de la course.
      </p>
      <div class="qr-actions">
        <Button
          label="Imprimer"
          icon="pi pi-print"
          severity="primary"
          :disabled="!svg"
          fluid
          @click="printQr"
        />
        <Button
          label="Régénérer"
          icon="pi pi-refresh"
          severity="secondary"
          text
          :loading="loading"
          @click="loadQr"
        />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.qr-card {
  width: 100%;
  max-width: 420px;
}
.qr-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  gap: 0.5rem;
}
.qr-svg {
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}
.qr-svg :deep(svg) {
  width: 240px;
  height: 240px;
  max-width: 65vw;
}
.qr-hint {
  text-align: center;
  margin: 0.75rem 0 0.5rem;
}
.qr-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
