import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '~/stores/auth'
import { useDriversStore } from '~/stores/drivers'
import { usePassengersStore } from '~/stores/passengers'
import { useTripStore } from '~/stores/trip'
import type {
  DriversSnapshotEvent,
  NearbyDriver,
  NearbyPassenger,
  PassengersSnapshotEvent,
  TripCompletedEvent,
  TripStartedEvent,
  UserIdEvent,
} from '~/types/api'

export default defineNuxtPlugin(() => {
  const {
    public: { socketUrl },
  } = useRuntimeConfig()
  const auth = useAuthStore()
  const drivers = useDriversStore()
  const passengers = usePassengersStore()
  const trip = useTripStore()

  // When served behind a reverse proxy (same-origin deployment), socketUrl is
  // empty and we connect to the current origin. Otherwise we use the provided
  // absolute URL.
  const resolvedUrl = socketUrl || window.location.origin

  const socket: Socket = io(resolvedUrl, {
    autoConnect: false,
    transports: ['websocket'],
    auth: (cb) => cb({ token: auth.token }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  socket.on('drivers:update', (d: NearbyDriver) => drivers.upsert(d))
  socket.on('drivers:snapshot', (d: DriversSnapshotEvent) =>
    drivers.replaceAll(d.drivers),
  )
  socket.on('driver:removed', (d: UserIdEvent) => drivers.remove(d.user_id))
  socket.on('passengers:update', (p: NearbyPassenger) => passengers.upsert(p))
  socket.on('passengers:snapshot', (p: PassengersSnapshotEvent) =>
    passengers.replaceAll(p.passengers),
  )
  socket.on('passenger:removed', (p: UserIdEvent) =>
    passengers.remove(p.user_id),
  )
  socket.on('trip:started', (e: TripStartedEvent) => {
    trip.handleStarted(e, auth.user?.id ?? null)
  })
  socket.on('trip:completed', (e: TripCompletedEvent) => {
    trip.handleCompleted(e)
  })

  socket.on('disconnect', () => {
    drivers.clear()
    passengers.clear()
  })

  watch(
    () => auth.token,
    (t) => {
      if (t && !socket.connected) {
        socket.auth = { token: t }
        socket.connect()
      }
      if (!t && socket.connected) {
        socket.disconnect()
      }
    },
    { immediate: true },
  )

  return { provide: { socket } }
})
