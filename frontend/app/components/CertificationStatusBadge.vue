<script setup lang="ts">
import type { CertificationStatus } from '~/types/api'

const props = withDefaults(
  defineProps<{
    status: CertificationStatus | 'none'
    expiresAt?: string | null
    /** Optional plain-text override for the badge label. */
    label?: string | null
    /** Show the expiration date inline instead of as a tooltip. */
    inlineExpiry?: boolean
  }>(),
  { expiresAt: null, label: null, inlineExpiry: false },
)

interface Mapping {
  label: string
  severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary'
  icon: string
}

const MAP: Record<typeof props.status, Mapping> = {
  none: {
    label: 'Non certifié',
    severity: 'secondary',
    icon: 'pi pi-circle-off',
  },
  pending_ocr: {
    label: 'Analyse en cours',
    severity: 'info',
    icon: 'pi pi-spin pi-spinner',
  },
  pending_review: {
    label: 'En attente de revue',
    severity: 'info',
    icon: 'pi pi-hourglass',
  },
  approved: {
    label: 'Certifié',
    severity: 'success',
    icon: 'pi pi-verified',
  },
  rejected: {
    label: 'Rejeté',
    severity: 'danger',
    icon: 'pi pi-times-circle',
  },
  expired: {
    label: 'Expiré',
    severity: 'warn',
    icon: 'pi pi-clock',
  },
}

const mapping = computed<Mapping>(() => MAP[props.status])

const expiryText = computed<string | null>(() => {
  if (!props.expiresAt) return null
  try {
    const d = new Date(`${props.expiresAt}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return null
  }
})

const tooltip = computed<string | null>(() => {
  if (!expiryText.value) return null
  if (props.status === 'approved') return `Valide jusqu'au ${expiryText.value}`
  if (props.status === 'expired') return `Expirée le ${expiryText.value}`
  if (props.status === 'pending_review' || props.status === 'pending_ocr') {
    return `Date détectée : ${expiryText.value}`
  }
  return null
})

const finalLabel = computed<string>(() => props.label || mapping.value.label)
</script>

<template>
  <span
    v-tooltip.top="tooltip ?? undefined"
    class="cert-badge-wrap"
  >
    <Tag :value="finalLabel" :severity="mapping.severity" :icon="mapping.icon" />
    <small v-if="inlineExpiry && expiryText" class="cert-badge-date">
      {{ expiryText }}
    </small>
  </span>
</template>

<style scoped>
.cert-badge-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}
.cert-badge-date {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
</style>
