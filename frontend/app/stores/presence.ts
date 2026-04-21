import { defineStore } from 'pinia'

/**
 * Local presence intent for the current user:
 *   - `driverOnline`  : le conducteur s'est déclaré en ligne sur /map,
 *   - `passengerWaiting` : le passager a appuyé sur « Je suis en attente ».
 *
 * This state used to live as local refs inside /map, which meant that
 * navigating away (e.g. to /scan to show the QR code) and coming back
 * reset the toggle to false even though the websocket connection — and
 * therefore the server-side `driver_status` / `passenger_waits` row —
 * was still up. Hoisting it to a Pinia store lets the UI survive those
 * cross-page trips and keep showing the correct toggle.
 *
 * Scope: single session. We intentionally do NOT persist to
 * localStorage: if the tab is closed the websocket drops and the
 * backend marks the user offline on `handleDisconnect`, so the next
 * cold start must begin in the offline state too.
 */
export const usePresenceStore = defineStore('presence', {
  state: () => ({
    driverOnline: false,
    passengerWaiting: false,
  }),
  actions: {
    setDriverOnline(value: boolean) {
      this.driverOnline = value
    },
    setPassengerWaiting(value: boolean) {
      this.passengerWaiting = value
    },
    reset() {
      this.driverOnline = false
      this.passengerWaiting = false
    },
  },
})
