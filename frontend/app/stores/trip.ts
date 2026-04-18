import { defineStore } from 'pinia'
import type { Trip, TripCompletedEvent, TripStartedEvent } from '~/types/api'

export const useTripStore = defineStore('trip', {
  state: () => ({
    activeTripId: null as string | null,
    lastStarted: null as TripStartedEvent | null,
    lastCompleted: null as TripCompletedEvent | null,
    role: null as 'passenger' | 'driver' | null,
  }),
  actions: {
    setFromApi(trip: Trip | null, currentUserId: string | null) {
      if (!trip) {
        this.activeTripId = null
        this.role = null
        return
      }
      this.activeTripId = trip.status === 'active' ? trip.id : null
      if (currentUserId) {
        this.role =
          trip.passenger_id === currentUserId
            ? 'passenger'
            : trip.driver_id === currentUserId
              ? 'driver'
              : null
      }
    },
    handleStarted(event: TripStartedEvent, currentUserId: string | null) {
      this.lastStarted = event
      this.activeTripId = event.trip_id
      if (currentUserId) {
        this.role =
          event.passenger_id === currentUserId
            ? 'passenger'
            : event.driver_id === currentUserId
              ? 'driver'
              : null
      }
    },
    handleCompleted(event: TripCompletedEvent) {
      this.lastCompleted = event
      if (this.activeTripId === event.trip_id) {
        this.activeTripId = null
        this.role = null
      }
    },
    clear() {
      this.activeTripId = null
      this.role = null
    },
  },
})
