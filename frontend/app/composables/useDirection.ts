import type { Direction } from '~/types/api'

const PAPEETE = { lng: -149.5665, lat: -17.5516 }

export function useDirection() {
  function bearingToPapeete(from: { lng: number; lat: number }): number {
    const toRad = (d: number) => (d * Math.PI) / 180
    const toDeg = (r: number) => (r * 180) / Math.PI
    const lat1 = toRad(from.lat)
    const lat2 = toRad(PAPEETE.lat)
    const dLon = toRad(PAPEETE.lng - from.lng)
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    const brng = toDeg(Math.atan2(y, x))
    return (brng + 360) % 360
  }

  function suggestDirection(params: {
    lng: number
    lat: number
    heading: number | null
  }): Direction {
    if (params.heading === null) return 'city'
    const targetBearing = bearingToPapeete({
      lng: params.lng,
      lat: params.lat,
    })
    const diff = Math.abs(
      ((params.heading - targetBearing + 540) % 360) - 180,
    )
    return diff <= 90 ? 'city' : 'country'
  }

  return {
    PAPEETE,
    bearingToPapeete,
    suggestDirection,
  }
}
