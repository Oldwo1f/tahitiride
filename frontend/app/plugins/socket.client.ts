import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '~/stores/auth'
import { useDriversStore } from '~/stores/drivers'
import { useGeoStore } from '~/stores/geo'
import { usePassengersStore } from '~/stores/passengers'
import { usePreferencesStore } from '~/stores/preferences'
import { usePresenceStore } from '~/stores/presence'
import { useTripStore } from '~/stores/trip'
import { getDestination } from '~/utils/destinations'
import type {
  Direction,
  DriversSnapshotEvent,
  NearbyDriver,
  NearbyPassenger,
  PassengersSnapshotEvent,
  TripCompletedEvent,
  TripDropoffRequestedEvent,
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
  const presence = usePresenceStore()
  const trip = useTripStore()
  const geo = useGeoStore()
  const prefs = usePreferencesStore()
  const { inferDirection } = useDirection()

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
  socket.on('trip:dropoff_requested', (e: TripDropoffRequestedEvent) => {
    trip.handleDropoffRequested(e, auth.user?.id ?? null)
  })

  socket.on('disconnect', () => {
    drivers.clear()
    passengers.clear()
  })

  /**
   * Resync the user's intent with the backend as soon as a new
   * websocket session is established. The backend marks drivers /
   * passengers offline on `handleDisconnect`, so after an automatic
   * reconnect the server-side row is gone even though the UI still
   * holds the "en ligne" intent. Re-emitting the role-specific event
   * re-inserts the row and is idempotent thanks to the
   * `ON CONFLICT DO UPDATE` semantics on the backend side.
   *
   * Running this from the plugin (instead of from /map only) ensures
   * the resync still happens when the user is on another route — for
   * instance while showing their QR code on /scan.
   */
  socket.on('connect', () => {
    const pos = geo.effective
    if (!pos) return
    const destKey = prefs.lastDestination
    const destCoords = destKey ? getDestination(destKey) : null
    const direction: Direction = destCoords
      ? inferDirection({
          from: { lng: pos.lng, lat: pos.lat },
          to: { lng: destCoords.lng, lat: destCoords.lat },
        })
      : 'city'
    if (auth.isDriver && presence.driverOnline) {
      socket.emit('driver:online', {
        direction,
        destination: destKey,
        lng: pos.lng,
        lat: pos.lat,
        heading: pos.heading,
        speed: pos.speed,
      })
    }
    if (!auth.isDriver && presence.passengerWaiting) {
      socket.emit('passenger:wait', {
        direction,
        destination: destKey,
        lng: pos.lng,
        lat: pos.lat,
      })
    }
  })

  watch(
    () => auth.token,
    (t, prev) => {
      // Token flipping means login / logout / user switch. Clear any
      // remembered presence so the new session starts from a clean
      // slate and a logged-out user never sees a stale "en ligne"
      // toggle when they log back in.
      if (prev !== undefined && t !== prev) {
        presence.reset()
      }
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

  /**
   * When the user toggles driver mode from /profile, the presence
   * toggle on /map must not stay true for the wrong role. We nudge the
   * websocket once so the backend presence row matches the new UI
   * state, then clear the stale flag locally.
   */
  watch(
    () => auth.isDriver,
    (isDriver, wasDriver) => {
      if (wasDriver === undefined) return
      if (isDriver === wasDriver) return
      if (!isDriver && presence.driverOnline) {
        if (socket.connected) socket.emit('driver:offline')
        presence.setDriverOnline(false)
        drivers.clear()
        passengers.clear()
      }
      if (isDriver && presence.passengerWaiting) {
        if (socket.connected) socket.emit('passenger:cancel_wait')
        presence.setPassengerWaiting(false)
        drivers.clear()
        passengers.clear()
      }
    },
  )

  return { provide: { socket } }
})
