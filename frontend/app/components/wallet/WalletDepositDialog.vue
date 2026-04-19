<script setup lang="ts">
import type { DepositInfoDto } from '~/types/api'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submitted'): void
}>()

const wallet = useWalletRequests()
const toast = useToast()

const visibleProxy = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const info = ref<DepositInfoDto | null>(null)
const amount = ref<number | null>(null)
const userNote = ref('')
const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function loadInfo() {
  loading.value = true
  errorMsg.value = null
  try {
    info.value = await wallet.fetchDepositInfo()
    amount.value = info.value.min_amount_xpf
  } catch (e: unknown) {
    errorMsg.value =
      (e as { data?: { message?: string } })?.data?.message ||
      'Impossible de charger les coordonnées bancaires'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      void loadInfo()
    } else {
      reset()
    }
  },
)

function reset() {
  amount.value = null
  userNote.value = ''
  errorMsg.value = null
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({
      severity: 'success',
      summary: 'Copié',
      detail: value,
      life: 2000,
    })
  } catch {
    /* clipboard unavailable */
  }
}

async function submit() {
  errorMsg.value = null
  if (!info.value) return
  const min = info.value.min_amount_xpf
  if (!amount.value || amount.value < min) {
    errorMsg.value = `Le montant minimum est de ${min} XPF`
    return
  }
  try {
    await wallet.createDeposit({
      amount_xpf: amount.value,
      user_note: userNote.value.trim() || null,
    })
    toast.add({
      severity: 'info',
      summary: 'Demande enregistrée',
      detail:
        'Votre wallet sera crédité dès que l’administrateur aura constaté le virement.',
      life: 5000,
    })
    emit('submitted')
    visibleProxy.value = false
  } catch (e: unknown) {
    const data = (e as { data?: { message?: string | string[] } })?.data
    errorMsg.value = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || 'Échec de l’envoi'
  }
}

const ribIncomplete = computed(() => {
  const i = info.value
  if (!i) return true
  return !i.iban || !i.bank_name || !i.account_holder
})
</script>

<template>
  <Dialog
    v-model:visible="visibleProxy"
    header="Ajouter des fonds"
    modal
    :style="{ width: '94vw', maxWidth: '520px' }"
    :closable="!wallet.submitting.value"
  >
    <div v-if="loading" class="dep-loading">
      <ProgressSpinner />
    </div>

    <template v-else-if="info">
      <p class="dep-help">
        Effectuez un virement bancaire vers le compte ci-dessous, puis
        cliquez sur « J’ai effectué le virement ». Votre wallet sera
        crédité dès qu’un administrateur aura constaté le virement.
      </p>

      <Message v-if="ribIncomplete" severity="warn" :closable="false">
        Les coordonnées bancaires de la plateforme ne sont pas encore
        configurées. Contactez l’administrateur.
      </Message>

      <div v-if="!ribIncomplete" class="dep-rib">
        <div class="dep-row">
          <div class="dep-row-label">Banque</div>
          <div class="dep-row-value">
            {{ info.bank_name }}
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              size="small"
              @click="copy(info.bank_name)"
            />
          </div>
        </div>
        <div class="dep-row">
          <div class="dep-row-label">Titulaire</div>
          <div class="dep-row-value">
            {{ info.account_holder }}
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              size="small"
              @click="copy(info.account_holder)"
            />
          </div>
        </div>
        <div class="dep-row">
          <div class="dep-row-label">IBAN</div>
          <div class="dep-row-value mono">
            {{ info.iban }}
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              size="small"
              @click="copy(info.iban)"
            />
          </div>
        </div>
        <div v-if="info.bic" class="dep-row">
          <div class="dep-row-label">BIC</div>
          <div class="dep-row-value mono">
            {{ info.bic }}
            <Button
              icon="pi pi-copy"
              severity="secondary"
              text
              size="small"
              @click="copy(info.bic)"
            />
          </div>
        </div>
        <div v-if="info.instructions" class="dep-instructions">
          <i class="pi pi-info-circle" />
          {{ info.instructions }}
        </div>
      </div>

      <div class="dep-form">
        <label class="dep-label">
          Montant viré (XPF)
          <InputNumber
            v-model="amount"
            :min="info.min_amount_xpf"
            :step="100"
            show-buttons
            button-layout="horizontal"
            suffix=" XPF"
            fluid
          />
        </label>
        <label class="dep-label">
          Référence du virement (optionnel)
          <Textarea
            v-model="userNote"
            rows="2"
            placeholder="Numéro de référence, libellé utilisé…"
            maxlength="500"
            class="dep-textarea"
          />
        </label>
      </div>

      <Message v-if="errorMsg" severity="error" :closable="false">
        {{ errorMsg }}
      </Message>
    </template>

    <template #footer>
      <Button
        label="Annuler"
        text
        :disabled="wallet.submitting.value"
        @click="visibleProxy = false"
      />
      <Button
        icon="pi pi-check"
        label="J’ai effectué le virement"
        :loading="wallet.submitting.value"
        :disabled="!info || ribIncomplete"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.dep-loading {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}
.dep-help {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
.dep-rib {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--p-surface-100);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
.p-dark .dep-rib {
  background: var(--p-surface-800);
}
.dep-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.dep-row-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dep-row-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-weight: 500;
  word-break: break-all;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
}
.dep-instructions {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  margin-top: 0.25rem;
}
.dep-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-top: 0.5rem;
}
.dep-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--p-text-color);
}
.dep-textarea {
  width: 100%;
  min-width: 0;
}
</style>
