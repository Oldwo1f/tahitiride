<script setup lang="ts">
import type { Trip } from '~/types/api'

const props = defineProps<{
  trip: Trip
  role: 'passenger' | 'driver' | null
}>()

const startTs = computed(() => new Date(props.trip.started_at).getTime())
const now = useNow({ interval: 1000 })
const elapsed = computed(() => {
  const ms = now.value.getTime() - startTs.value
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s.toString().padStart(2, '0')}s`
})
</script>

<template>
  <div class="trip-sheet safe-bottom">
    <div class="row">
      <Tag :value="role === 'driver' ? 'Conducteur' : 'Passager'" />
      <span class="tr-subtle">Trajet actif · {{ elapsed }}</span>
    </div>
    <div v-if="role === 'passenger'" class="row">
      <Button
        label="Je descends (scanner le QR)"
        icon="pi pi-qrcode"
        severity="success"
        fluid
        size="large"
        @click="navigateTo('/scan')"
      />
    </div>
    <div v-else class="row">
      <p class="tr-subtle" style="margin: 0;">
        Attendez que le passager scanne votre QR à l'arrivée pour terminer.
      </p>
    </div>
  </div>
</template>

<style scoped>
.trip-sheet {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-0);
  border-top: 1px solid var(--p-surface-200);
}
.p-dark .trip-sheet {
  background: var(--p-surface-900);
  border-top-color: var(--p-surface-700);
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}
</style>
