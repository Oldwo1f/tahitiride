<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  /** Current wallet balance, used as the default amount and upper bound. */
  balanceXpf: number
  /** Min wallet balance required to allow the dialog (informational). */
  minBalanceXpf: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submitted'): void
}>()

const wallet = useWalletRequests()
const auth = useAuthStore()
const toast = useToast()

const visibleProxy = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const iban = ref('')
const holder = ref('')
const amount = ref<number | null>(null)
const errorMsg = ref<string | null>(null)
const loading = ref(false)

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      amount.value = props.balanceXpf
      holder.value = auth.user?.full_name ?? ''
      errorMsg.value = null
      await loadLastIban()
    } else {
      reset()
    }
  },
)

function reset() {
  iban.value = ''
  holder.value = ''
  amount.value = null
  errorMsg.value = null
}

async function loadLastIban() {
  loading.value = true
  try {
    const { iban: lastIban, account_holder_name: lastHolder } =
      await wallet.fetchLastIban()
    if (lastIban) iban.value = formatIban(lastIban)
    if (lastHolder) holder.value = lastHolder
  } catch {
    // pre-fill is best-effort; leave fields empty
  } finally {
    loading.value = false
  }
}

function formatIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()
}

const cleanedIban = computed(() => iban.value.replace(/\s+/g, '').toUpperCase())
const ibanValid = computed(() =>
  /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleanedIban.value),
)

function onIbanInput(event: Event) {
  const next = (event.target as HTMLInputElement).value
  iban.value = next.toUpperCase()
}

function onIbanBlur() {
  if (cleanedIban.value) {
    iban.value = formatIban(cleanedIban.value)
  }
}

async function submit() {
  errorMsg.value = null
  if (!ibanValid.value) {
    errorMsg.value = 'IBAN invalide'
    return
  }
  if (!holder.value || holder.value.trim().length < 2) {
    errorMsg.value = 'Renseignez le titulaire du compte'
    return
  }
  if (!amount.value || amount.value <= 0) {
    errorMsg.value = 'Renseignez un montant'
    return
  }
  if (amount.value > props.balanceXpf) {
    errorMsg.value = `Montant supérieur à votre solde (${props.balanceXpf} XPF)`
    return
  }

  try {
    await wallet.createPayout({
      amount_xpf: amount.value,
      iban: cleanedIban.value,
      account_holder_name: holder.value.trim(),
    })
    toast.add({
      severity: 'info',
      summary: 'Demande envoyée',
      detail:
        'L’administrateur va effectuer le virement puis débiter votre wallet.',
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
</script>

<template>
  <Dialog
    v-model:visible="visibleProxy"
    header="Demander un virement"
    modal
    :style="{ width: '94vw', maxWidth: '480px' }"
    :closable="!wallet.submitting.value"
  >
    <p class="payout-help">
      Renseignez l’IBAN sur lequel vous souhaitez recevoir vos gains.
      Une fois validée, l’administrateur effectuera le virement puis
      débitera votre wallet.
    </p>

    <div class="payout-form">
      <label class="payout-label">
        IBAN
        <InputText
          :model-value="iban"
          placeholder="FR76 0000 0000 0000 0000 0000 000"
          fluid
          :invalid="!!iban && !ibanValid"
          @input="onIbanInput"
          @blur="onIbanBlur"
        />
        <small v-if="loading" class="payout-hint">
          <i class="pi pi-spin pi-spinner" /> Chargement du dernier IBAN…
        </small>
        <small
          v-else-if="iban && !ibanValid"
          class="payout-hint payout-hint-error"
        >
          IBAN invalide (15 à 34 caractères, commence par 2 lettres)
        </small>
      </label>

      <label class="payout-label">
        Titulaire du compte
        <InputText
          v-model="holder"
          placeholder="NOM Prénom"
          maxlength="120"
          fluid
        />
      </label>

      <label class="payout-label">
        Montant à virer (XPF)
        <InputNumber
          v-model="amount"
          :min="1"
          :max="props.balanceXpf"
          :step="100"
          show-buttons
          button-layout="horizontal"
          suffix=" XPF"
          fluid
        />
        <small class="payout-hint">
          Solde disponible :
          <strong>{{ props.balanceXpf.toLocaleString('fr-FR') }} XPF</strong>
        </small>
      </label>
    </div>

    <Message v-if="errorMsg" severity="error" :closable="false">
      {{ errorMsg }}
    </Message>

    <template #footer>
      <Button
        label="Annuler"
        text
        :disabled="wallet.submitting.value"
        @click="visibleProxy = false"
      />
      <Button
        icon="pi pi-send"
        label="Demander le virement"
        :loading="wallet.submitting.value"
        :disabled="
          !ibanValid ||
            !amount ||
            amount > props.balanceXpf ||
            props.balanceXpf < props.minBalanceXpf
        "
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.payout-help {
  margin: 0 0 1rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
.payout-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.payout-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.payout-hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.payout-hint-error {
  color: var(--p-red-500);
}
</style>
