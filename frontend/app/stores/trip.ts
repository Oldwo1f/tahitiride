import { defineStore } from 'pinia'
import type {
  Trip,
  TripCompletedEvent,
  TripDropoffRequestedEvent,
  TripStartedEvent,
} from '~/types/api'

export const useTripStore = defineStore('trip', {
  state: () => ({
    /** The current user's own active trip as a passenger (a passenger can only ride one car at a time). */
    activeTripId: null as string | null,
    lastStarted: null as TripStartedEvent | null,
    lastCompleted: null as TripCompletedEvent | null,
    role: null as 'passenger' | 'driver' | null,
    /**
     * Driver-side: passenger dropoff requests waiting for confirmation,
     * keyed by trip id. Multiple passengers can ask to leave at once.
     */
    pendingDropoffs: {} as Record<string, TripDropoffRequestedEvent>,
    /** Passenger-side: trip ids for which the user already pressed "I'm getting out" and is awaiting driver confirmation. */
    awaitingDropoffConfirmation: [] as string[],
  }),
  getters: {
    isAwaitingDropoff: (s) => (tripId: string): boolean =>
      s.awaitingDropoffConfirmation.includes(tripId),
    pendingDropoffList: (s): TripDropoffRequestedEvent[] =>
      Object.values(s.pendingDropoffs),
  },
  actions: {
    setFromApi(trip: Trip | null, currentUserId: string | null) {
      if (!trip || trip.status !== 'active') {
        this.activeTripId = null
        this.role = null
        return
      }
      const myRole =
        currentUserId && trip.passenger_id === currentUserId
          ? 'passenger'
          : currentUserId && trip.driver_id === currentUserId
            ? 'driver'
            : null
      // Drivers can have multiple active trips at once; their "current
      // active trip" concept doesn't really apply, so we don't persist
      // one. Passengers always have at most one.
      if (myRole === 'passenger') {
        this.activeTripId = trip.id
      } else {
        this.activeTripId = null
      }
      this.role = myRole
    },
    handleStarted(event: TripStartedEvent, currentUserId: string | null) {
      this.lastStarted = event
      const myRole =
        currentUserId && event.passenger_id === currentUserId
          ? 'passenger'
          : currentUserId && event.driver_id === currentUserId
            ? 'driver'
            : null
      if (myRole === 'passenger') {
        this.activeTripId = event.trip_id
      }
      this.role = myRole
    },
    handleCompleted(event: TripCompletedEvent) {
      this.lastCompleted = event
      if (this.activeTripId === event.trip_id) {
        this.activeTripId = null
        this.role = null
      }
      delete this.pendingDropoffs[event.trip_id]
      this.awaitingDropoffConfirmation =
        this.awaitingDropoffConfirmation.filter((id) => id !== event.trip_id)
    },
    handleDropoffRequested(
      event: TripDropoffRequestedEvent,
      currentUserId: string | null,
    ) {
      // For the driver: queue the request so the UI can show a confirm
      // dialog. For the passenger themselves: mark the trip as awaiting
      // confirmation so we can switch the button to "waiting…".
      if (currentUserId && currentUserId === event.passenger_id) {
        if (!this.awaitingDropoffConfirmation.includes(event.trip_id)) {
          this.awaitingDropoffConfirmation.push(event.trip_id)
        }
      } else {
        this.pendingDropoffs[event.trip_id] = event
      }
    },
    dismissPendingDropoff(tripId: string) {
      delete this.pendingDropoffs[tripId]
    },
    clear() {
      this.activeTripId = null
      this.role = null
      this.pendingDropoffs = {}
      this.awaitingDropoffConfirmation = []
    },
  },
})
