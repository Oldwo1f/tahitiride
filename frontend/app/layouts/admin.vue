<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const drawerOpen = ref(false)

const walletRequests = useAdminWalletRequests()

interface MenuEntry {
  label: string
  to: string
  icon: string
  match?: string[]
  /** Optional reactive badge value (rendered when > 0). */
  badge?: ComputedRef<number>
}

const menu = computed<MenuEntry[]>(() => [
  { label: 'Tableau de bord', to: '/admin', icon: 'pi pi-chart-line' },
  {
    label: 'Utilisateurs',
    to: '/admin/users',
    icon: 'pi pi-users',
    match: ['/admin/users'],
  },
  {
    label: 'Wallets',
    to: '/admin/wallets',
    icon: 'pi pi-wallet',
    match: ['/admin/wallets'],
  },
  {
    label: 'Demandes wallet',
    to: '/admin/wallet-requests',
    icon: 'pi pi-arrow-right-arrow-left',
    match: ['/admin/wallet-requests'],
    badge: computed(() => walletRequests.pendingCount.value),
  },
  {
    label: 'Trajets',
    to: '/admin/trips',
    icon: 'pi pi-car',
    match: ['/admin/trips'],
  },
  {
    label: 'Véhicules',
    to: '/admin/vehicles',
    icon: 'pi pi-truck',
    match: ['/admin/vehicles'],
  },
  {
    label: 'Certifications',
    to: '/admin/certifications',
    icon: 'pi pi-verified',
    match: ['/admin/certifications'],
  },
  {
    label: 'Paramètres',
    to: '/admin/settings',
    icon: 'pi pi-sliders-h',
    match: ['/admin/settings'],
  },
  {
    label: 'Audit',
    to: '/admin/audit',
    icon: 'pi pi-shield',
    match: ['/admin/audit'],
  },
])

function badgeOf(entry: MenuEntry): number {
  return entry.badge ? entry.badge.value : 0
}

function isActive(entry: MenuEntry): boolean {
  if (entry.to === '/admin') return route.path === '/admin'
  if (entry.match) {
    return entry.match.some(
      (m) => route.path === m || route.path.startsWith(m + '/'),
    )
  }
  return route.path === entry.to
}

async function logout() {
  auth.logout()
  drawerOpen.value = false
  await navigateTo('/login')
}

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <i class="pi pi-shield" />
        <span>Kartiki · Admin</span>
      </div>
      <nav class="admin-nav">
        <NuxtLink
          v-for="entry in menu"
          :key="entry.to"
          :to="entry.to"
          class="admin-link"
          :class="{ 'admin-link-active': isActive(entry) }"
        >
          <i :class="entry.icon" />
          <span>{{ entry.label }}</span>
          <Badge
            v-if="badgeOf(entry) > 0"
            :value="badgeOf(entry)"
            severity="warn"
            class="admin-link-badge"
          />
        </NuxtLink>
      </nav>
      <div class="admin-footer">
        <div class="admin-user">
          <div class="admin-user-name">{{ auth.user?.full_name }}</div>
          <div class="admin-user-email">{{ auth.user?.email }}</div>
        </div>
        <Button
          icon="pi pi-sign-out"
          label="Déconnexion"
          severity="secondary"
          size="small"
          fluid
          @click="logout"
        />
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <Button
          class="admin-menu-toggle"
          icon="pi pi-bars"
          severity="secondary"
          text
          @click="drawerOpen = true"
        />
        <div class="admin-topbar-title">Back-office</div>
        <NuxtLink to="/map" class="admin-back">
          <i class="pi pi-arrow-left" /> App utilisateur
        </NuxtLink>
      </header>
      <main class="admin-content">
        <slot />
      </main>
    </div>

    <Drawer
      v-model:visible="drawerOpen"
      position="left"
      class="admin-drawer"
      :show-close-icon="true"
    >
      <template #header>
        <div class="admin-brand">
          <i class="pi pi-shield" />
          <span>Kartiki · Admin</span>
        </div>
      </template>
      <nav class="admin-nav">
        <NuxtLink
          v-for="entry in menu"
          :key="entry.to"
          :to="entry.to"
          class="admin-link"
          :class="{ 'admin-link-active': isActive(entry) }"
        >
          <i :class="entry.icon" />
          <span>{{ entry.label }}</span>
          <Badge
            v-if="badgeOf(entry) > 0"
            :value="badgeOf(entry)"
            severity="warn"
            class="admin-link-badge"
          />
        </NuxtLink>
      </nav>
      <div class="admin-footer">
        <div class="admin-user">
          <div class="admin-user-name">{{ auth.user?.full_name }}</div>
          <div class="admin-user-email">{{ auth.user?.email }}</div>
        </div>
        <Button
          icon="pi pi-sign-out"
          label="Déconnexion"
          severity="secondary"
          size="small"
          fluid
          @click="logout"
        />
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: var(--p-surface-50);
}
.p-dark .admin-shell {
  background: var(--p-surface-950);
}

.admin-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--p-surface-0);
  border-right: 1px solid var(--p-surface-200);
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 1rem;
}
.p-dark .admin-sidebar {
  background: var(--p-surface-900);
  border-right-color: var(--p-surface-700);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: var(--p-primary-color);
  font-size: 1rem;
}
.admin-brand i {
  font-size: 1.25rem;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}
.admin-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  color: var(--p-text-color);
  text-decoration: none;
  font-size: 0.9rem;
}
.admin-link i {
  font-size: 1rem;
  width: 1.25rem;
  text-align: center;
}
.admin-link:hover {
  background: var(--p-surface-100);
}
.p-dark .admin-link:hover {
  background: var(--p-surface-800);
}
.admin-link-active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}
.admin-link-active:hover {
  background: var(--p-primary-color);
}
.admin-link-badge {
  margin-left: auto;
}

.admin-footer {
  border-top: 1px solid var(--p-surface-200);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.p-dark .admin-footer {
  border-top-color: var(--p-surface-700);
}
.admin-user-name {
  font-weight: 600;
  font-size: 0.9rem;
}
.admin-user-email {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  word-break: break-all;
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.admin-topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: var(--p-surface-0);
  border-bottom: 1px solid var(--p-surface-200);
}
.p-dark .admin-topbar {
  background: var(--p-surface-900);
  border-bottom-color: var(--p-surface-700);
}
.admin-topbar-title {
  font-weight: 600;
  font-size: 1rem;
  flex: 1;
}
.admin-back {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  text-decoration: none;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
.admin-back:hover {
  color: var(--p-primary-color);
}

.admin-menu-toggle {
  display: none !important;
}

.admin-content {
  padding: 1.25rem;
  flex: 1;
  overflow-x: auto;
}

@media (max-width: 900px) {
  .admin-sidebar {
    display: none;
  }
  .admin-menu-toggle {
    display: inline-flex !important;
  }
  .admin-content {
    padding: 1rem;
  }
}
</style>

<style>
.admin-drawer .p-drawer-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
