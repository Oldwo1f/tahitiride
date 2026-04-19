/**
 * Loads the Facebook JS SDK lazily on the client and exposes a
 * `$facebookReady` promise that resolves to the global `FB` object
 * once `FB.init` has been called.
 *
 * No-op when `NUXT_PUBLIC_FACEBOOK_APP_ID` is empty: the
 * `FacebookLoginButton` checks for the same flag and hides itself,
 * so we avoid loading the third-party script (and the privacy-side
 * effects that come with it) for self-hosted dev setups that don't
 * want Facebook integration.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const {
    public: { facebookAppId },
  } = useRuntimeConfig()

  if (!facebookAppId) {
    return {
      provide: {
        facebookReady: Promise.reject<typeof FB>(
          new Error('Facebook login disabled (no NUXT_PUBLIC_FACEBOOK_APP_ID)'),
        ),
      },
    }
  }

  // Suppress the "unhandled rejection" warning for the disabled-case
  // promise above — the button never awaits it when the App ID is
  // empty (it hides itself first).
  const ready = new Promise<typeof FB>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Facebook SDK requires a browser context'))
      return
    }

    // Idempotent: if another component already loaded the SDK we
    // simply wait for the existing init to settle.
    if (window.FB) {
      resolve(window.FB)
      return
    }

    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error('Facebook SDK loaded without exposing FB'))
        return
      }
      window.FB.init({
        appId: facebookAppId as string,
        version: 'v20.0',
        cookie: false,
        xfbml: false,
        status: false,
      })
      resolve(window.FB)
    }

    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/fr_FR/sdk.js'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'))
    document.head.appendChild(script)
  })

  return {
    provide: { facebookReady: ready },
  }
})

declare module '#app' {
  interface NuxtApp {
    $facebookReady: Promise<typeof FB>
  }
}
