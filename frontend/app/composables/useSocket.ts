import type { Socket } from 'socket.io-client'

export function useSocket() {
  const nuxt = useNuxtApp()
  return nuxt.$socket as Socket
}
