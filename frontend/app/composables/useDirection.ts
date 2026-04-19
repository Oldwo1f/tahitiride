import type { Direction } from '~/types/api'

const PAPEETE = { lng: -149.5665, lat: -17.5516 }

interface LngLat {
  lng: number
  lat: number
}

function toRad(d: number): number {
  return (d * Math.PI) / 180
}

function haversine(a: LngLat, b: LngLat): number {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(x))
}

export function useDirection() {
  /**
   * Infer the categorical trip direction from the rider position and the
   * chosen destination, relative to Papeete (the reference urban hub):
   *
   *   - destination strictly closer to Papeete than the current position
   *     -> 'city' (we are heading inwards),
   *   - otherwise (further or equal) -> 'country' (we are heading out).
   *
   * This makes the choice deterministic and removes the need for a manual
   * toggle in the UI.
   */
  function inferDirection(params: { from: LngLat; to: LngLat }): Direction {
    const fromDist = haversine(params.from, PAPEETE)
    const toDist = haversine(params.to, PAPEETE)
    return toDist < fromDist ? 'city' : 'country'
  }

  return {
    PAPEETE,
    haversine,
    inferDirection,
  }
}
