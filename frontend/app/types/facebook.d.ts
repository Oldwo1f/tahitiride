/**
 * Minimal type surface for the Facebook JavaScript SDK injected by
 * `plugins/facebook.client.ts`. Only the few methods we actually call
 * are typed — the full d.ts is published as `@types/facebook-js-sdk`
 * but pulling that whole dependency just for `FB.init` + `FB.login`
 * would be overkill.
 *
 * @see https://developers.facebook.com/docs/javascript/reference
 */
export {}

declare global {
  namespace FB {
    interface InitParams {
      appId: string
      version: string
      cookie?: boolean
      xfbml?: boolean
      status?: boolean
    }

    interface AuthResponse {
      accessToken: string
      userID: string
      expiresIn: number
      signedRequest: string
      graphDomain?: string
      data_access_expiration_time?: number
    }

    type LoginStatus = 'connected' | 'not_authorized' | 'unknown'

    interface LoginResponse {
      status: LoginStatus
      authResponse: AuthResponse | null
    }

    interface LoginOptions {
      scope?: string
      auth_type?: 'rerequest' | 'reauthenticate' | 'reauthorize'
      return_scopes?: boolean
    }

    function init(params: InitParams): void
    function login(
      callback: (response: LoginResponse) => void,
      options?: LoginOptions,
    ): void
    function logout(callback?: (response: LoginResponse) => void): void
    function getLoginStatus(
      callback: (response: LoginResponse) => void,
    ): void
  }

  interface Window {
    FB?: typeof FB
    fbAsyncInit?: () => void
  }
}
