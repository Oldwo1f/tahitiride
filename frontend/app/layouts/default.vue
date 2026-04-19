<script setup lang="ts">
const auth = useAuthStore()
</script>

<template>
  <div class="tr-page">
    <div class="tr-scroll">
      <slot />
    </div>
    <BottomNav />
    <CertificationReminderToast v-if="auth.isAuthed && auth.isDriver" />
  </div>
</template>
