<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})
onMounted(() => navigateTo('/map', { replace: true }))
</script>

<template>
  <div class="tr-center" style="height: 100dvh;">
    <ProgressSpinner />
  </div>
</template>
