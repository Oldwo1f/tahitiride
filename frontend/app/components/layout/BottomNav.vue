<script setup lang="ts">
const items = computed(() => [
  { to: '/map', label: 'Carte', icon: 'pi pi-map' },
  { to: '/trips', label: 'Trajets', icon: 'pi pi-history' },
  { to: '/scan', label: 'QR', icon: 'pi pi-qrcode' },
  { to: '/wallet', label: 'Solde', icon: 'pi pi-wallet' },
  { to: '/profile', label: 'Profil', icon: 'pi pi-user' },
])
const route = useRoute()
const isActive = (to: string) => {
  if (to === '/trips') {
    return (
      route.path === '/trips' ||
      route.path.startsWith('/trips/') ||
      route.path.startsWith('/trip/')
    )
  }
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <nav class="bottom-nav safe-bottom">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="bn-item"
      :class="{ 'bn-active': isActive(item.to) }"
    >
      <i :class="item.icon" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  background: var(--p-surface-0);
  border-top: 1px solid var(--p-surface-200);
  padding-top: 6px;
  padding-bottom: max(6px, env(safe-area-inset-bottom));
}
.p-dark .bottom-nav {
  background: var(--p-surface-900);
  border-top-color: var(--p-surface-700);
}
.bn-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--p-text-muted-color);
  text-decoration: none;
  padding: 6px 0;
  font-size: 11px;
}
.bn-item i {
  font-size: 22px;
}
.bn-active {
  color: var(--p-primary-color);
}
</style>
