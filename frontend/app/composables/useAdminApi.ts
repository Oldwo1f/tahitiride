import type { NitroFetchOptions } from 'nitropack'

/**
 * Thin wrapper over `useApi()` that prefixes every request with `/api/admin`
 * and tightens typings for our admin endpoints. Doesn't add any caching:
 * admin pages always want fresh data and the service worker already has
 * `/api/*` on `NetworkOnly`.
 */
export function useAdminApi() {
  const api = useApi()

  function path(p: string): string {
    if (p.startsWith('/')) return `/api/admin${p}`
    return `/api/admin/${p}`
  }

  return {
    get<T>(
      url: string,
      query?: Record<string, string | number | undefined | null>,
    ): Promise<T> {
      const params: Record<string, string | number> = {}
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined && v !== null && v !== '') params[k] = v
        }
      }
      return api<T>(path(url), {
        method: 'GET',
        query: params,
      } as NitroFetchOptions<string>)
    },
    post<T>(url: string, body?: unknown): Promise<T> {
      return api<T>(path(url), {
        method: 'POST',
        body,
      } as NitroFetchOptions<string>)
    },
    patch<T>(url: string, body?: unknown): Promise<T> {
      return api<T>(path(url), {
        method: 'PATCH',
        body,
      } as NitroFetchOptions<string>)
    },
    del<T>(url: string): Promise<T> {
      return api<T>(path(url), {
        method: 'DELETE',
      } as NitroFetchOptions<string>)
    },
  }
}
