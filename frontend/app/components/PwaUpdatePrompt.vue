<script setup lang="ts">
const { $pwa } = useNuxtApp()
</script>

<template>
  <Dialog
    v-if="$pwa"
    :visible="Boolean($pwa.needRefresh)"
    :closable="false"
    modal
    header="Mise à jour disponible"
  >
    <p>Une nouvelle version de l'application est prête.</p>
    <template #footer>
      <Button
        label="Plus tard"
        text
        @click="$pwa.cancelPrompt?.()"
      />
      <Button
        label="Recharger"
        @click="$pwa.updateServiceWorker?.(true)"
      />
    </template>
  </Dialog>
</template>
