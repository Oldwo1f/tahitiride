<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'fr' },
})
</script>

<template>
  <div class="tr-root">
    <VitePwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toast position="top-center" />
    <ConfirmDialog />
    <PwaUpdatePrompt />
  </div>
</template>

<style>
.tr-root {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
</style>
