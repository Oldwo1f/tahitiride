<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Direct image source. When set takes precedence over initials. */
    src?: string | null
    /** Used to compute initials and the deterministic background color. */
    firstName?: string | null
    lastName?: string | null
    /** Fallback when first/last are both empty (uses first 1-2 letters). */
    fullName?: string | null
    /** PrimeVue `<Avatar>` size token. */
    size?: 'normal' | 'large' | 'xlarge'
    /** Visual shape — circle is recommended for profile use cases. */
    shape?: 'square' | 'circle'
    /** Optional aria-label override (defaults to `Avatar de <name>`). */
    label?: string | null
  }>(),
  {
    src: null,
    firstName: null,
    lastName: null,
    fullName: null,
    size: 'normal',
    shape: 'circle',
    label: null,
  },
)

const auth = useAuthStore()

// Deterministic palette picked from PrimeVue Aura tones. Hashing on the
// normalised name guarantees the same person always gets the same color
// across pages (avatar in admin lists, profile, trip sheet, etc).
const PALETTE = [
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const initials = computed<string>(() => {
  const f = (props.firstName ?? '').trim()
  const l = (props.lastName ?? '').trim()
  if (f || l) {
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  }
  const full = (props.fullName ?? '').trim()
  if (!full) return '?'
  const tokens = full.split(/\s+/)
  if (tokens.length >= 2) {
    return `${tokens[0]!.charAt(0)}${tokens[1]!.charAt(0)}`.toUpperCase()
  }
  return full.slice(0, 2).toUpperCase()
})

const colorKey = computed<string>(() => {
  const f = (props.firstName ?? '').trim().toLowerCase()
  const l = (props.lastName ?? '').trim().toLowerCase()
  const full = (props.fullName ?? '').trim().toLowerCase()
  return [f, l, full].filter(Boolean).join(' ') || '?'
})

const bgColor = computed<string>(() => {
  return PALETTE[hashString(colorKey.value) % PALETTE.length] ?? PALETTE[0]!
})

// `src` may be a relative `/api/uploads/...` path. The `<img>` element
// will receive the configured `apiBase` prefix so it works in dev and in
// the same-origin Docker deployment alike. Remote URLs (already absolute)
// are passed through unchanged.
const resolvedSrc = computed<string | null>(() => {
  if (!props.src) return null
  if (/^https?:\/\//i.test(props.src)) return props.src
  const { public: pub } = useRuntimeConfig()
  const base = (pub.apiBase as string) || ''
  if (!base) return props.src
  return `${base}${props.src}`
})

const ariaLabel = computed<string>(() => {
  if (props.label) return props.label
  const name =
    [props.firstName, props.lastName].filter(Boolean).join(' ') ||
    props.fullName ||
    ''
  return name ? `Avatar de ${name}` : 'Avatar'
})

// Avatars served by `/api/uploads/...` require the JWT, but `<img>` tags
// can't add an Authorization header. We blob-fetch the image with the
// auth store token and produce an object URL the browser can render.
const blobUrl = ref<string | null>(null)
const loading = ref(false)
const errored = ref(false)

async function loadAvatar(): Promise<void> {
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = null
  }
  errored.value = false
  if (!resolvedSrc.value) return
  if (!auth.token) {
    // Without auth we just degrade to initials — never show a broken image.
    errored.value = true
    return
  }
  loading.value = true
  try {
    const res = await fetch(resolvedSrc.value, {
      headers: { Authorization: `Bearer ${auth.token}` },
      credentials: 'omit',
    })
    if (!res.ok) {
      errored.value = true
      return
    }
    const blob = await res.blob()
    blobUrl.value = URL.createObjectURL(blob)
  } catch {
    errored.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadAvatar)
watch(resolvedSrc, () => loadAvatar())

onBeforeUnmount(() => {
  if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
})

const showImage = computed<boolean>(
  () => !!resolvedSrc.value && !errored.value && !!blobUrl.value,
)
</script>

<template>
  <Avatar
    :image="showImage ? blobUrl ?? undefined : undefined"
    :label="!showImage ? initials : undefined"
    :shape="shape"
    :size="size"
    :aria-label="ariaLabel"
    :style="!showImage ? { backgroundColor: bgColor, color: '#fff' } : undefined"
    class="letter-avatar"
  />
</template>

<style scoped>
.letter-avatar {
  font-weight: 600;
  user-select: none;
}
</style>
