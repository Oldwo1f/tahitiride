<script setup lang="ts">
defineProps<{
  title?: string
  backTo?: string
  showBack?: boolean
}>()
const router = useRouter()
const goBack = () => router.back()
</script>

<template>
  <header class="topbar safe-top">
    <div class="tb-inner">
      <Button
        v-if="showBack || backTo"
        text
        rounded
        :aria-label="'Retour'"
        @click="backTo ? $router.push(backTo) : goBack()"
      >
        <i class="pi pi-arrow-left" />
      </Button>
      <h1 class="tb-title">{{ title || 'Tahiti Ride' }}</h1>
      <div class="tb-spacer" />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  background: var(--p-surface-0);
  border-bottom: 1px solid var(--p-surface-200);
}
.p-dark .topbar {
  background: var(--p-surface-900);
  border-bottom-color: var(--p-surface-700);
}
.tb-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-height: 52px;
}
.tb-title {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
}
.tb-spacer {
  width: 40px;
}
</style>
