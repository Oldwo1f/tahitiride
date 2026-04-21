import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

/**
 * Brand palette derived from the Kartiki logo.
 *
 * - Primary  = navy `#0c4489` (logo text + circle stroke, dominant anchor)
 * - Accent   = teal `#0eacc9` / `#29c4ca` (sky + lagoon, used as CSS vars)
 * - Natural  = green `#0ca94b` (mountains, used as CSS vars)
 *
 * We only override the PrimeVue `primary` semantic token; teal and green live
 * as CSS custom properties in `main.css` so any component can opt into them.
 */
const KartikiPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e7ecf5',
      100: '#c3cfe5',
      200: '#9cb1d4',
      300: '#6e8bbe',
      400: '#3c66a6',
      500: '#0c4489',
      600: '#0a3d7c',
      700: '#08336a',
      800: '#062855',
      900: '#051e40',
      950: '#021128',
    },
  },
})

export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@primevue/nuxt-module',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
  ],

  components: [{ path: '~/components', pathPrefix: false }],

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001',
      socketUrl: 'http://localhost:3001',
      mapboxToken: '',
      // Empty string disables the "Continue with Facebook" button at
      // runtime (the FB SDK is only loaded when an App ID is set).
      facebookAppId: '',
    },
  },

  css: ['~/assets/css/main.css', 'primeicons/primeicons.css'],

  app: {
    head: {
      title: 'Kartiki',
      viewport:
        'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no',
      meta: [
        { name: 'theme-color', content: '#0c4489' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
        {
          name: 'description',
          content: 'Covoiturage décentralisé en temps réel pour Tahiti',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '96x96',
          href: '/favicon-96x96.png',
        },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },

  primevue: {
    options: {
      ripple: true,
      theme: {
        preset: KartikiPreset,
        options: {
          darkModeSelector: '.p-dark',
          cssLayer: false,
        },
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    strategies: 'generateSW',
    manifest: {
      name: 'Kartiki',
      short_name: 'Kartiki',
      description: 'Covoiturage décentralisé en temps réel pour Tahiti',
      lang: 'fr-PF',
      theme_color: '#0c4489',
      background_color: '#0c4489',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/favicon-96x96.png',
          sizes: '96x96',
          type: 'image/png',
        },
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
      navigateFallback: '/',
      navigateFallbackDenylist: [
        /^\/api\//,
        /^\/socket\.io\//,
        /^\/auth\//,
      ],
      runtimeCaching: [
        {
          urlPattern: ({ url }: { url: URL }) =>
            url.pathname.startsWith('/api/') ||
            url.pathname.startsWith('/socket.io/') ||
            url.pathname.startsWith('/auth/'),
          handler: 'NetworkOnly',
        },
        {
          urlPattern: /^https?:\/\/localhost:3001\/.*/i,
          handler: 'NetworkOnly',
        },
        {
          urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
          handler: 'NetworkOnly',
        },
        {
          urlPattern: /^https:\/\/(a|b|c|d)\.tiles\.mapbox\.com\/.*/i,
          handler: 'NetworkOnly',
        },
        {
          urlPattern: /^https:\/\/events\.mapbox\.com\/.*/i,
          handler: 'NetworkOnly',
        },
      ],
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: false,
      type: 'module',
      navigateFallback: '/',
    },
  },

  typescript: { strict: true, typeCheck: false },

  vite: {
    optimizeDeps: {
      include: ['mapbox-gl', 'qr-scanner', 'qrcode', 'socket.io-client'],
    },
  },
})
