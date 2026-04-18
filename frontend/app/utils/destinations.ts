export type Coast = 'west' | 'east' | 'both'

export interface Destination {
  key: string
  label: string
  coast: Coast
  lng: number
  lat: number
}

// Main cities of Tahiti, grouped by coast (Papeete and Taravao border both coasts).
// Keys are stable identifiers stored in DB; labels are what we display.
export const DESTINATIONS: Destination[] = [
  { key: 'papeete', label: 'Papeete', coast: 'both', lng: -149.5665, lat: -17.5516 },
  { key: 'faaa', label: "Faa'a", coast: 'west', lng: -149.6063, lat: -17.5559 },
  { key: 'punaauia', label: "Puna'auia", coast: 'west', lng: -149.6196, lat: -17.6328 },
  { key: 'paea', label: 'Paea', coast: 'west', lng: -149.5878, lat: -17.6919 },
  { key: 'papara', label: 'Papara', coast: 'west', lng: -149.5408, lat: -17.7497 },
  { key: 'mataiea', label: 'Mataiea', coast: 'west', lng: -149.4214, lat: -17.7700 },
  { key: 'papeari', label: 'Papeari', coast: 'west', lng: -149.3528, lat: -17.7475 },
  { key: 'pirae', label: 'Pirae', coast: 'east', lng: -149.5500, lat: -17.5311 },
  { key: 'arue', label: 'Arue', coast: 'east', lng: -149.5253, lat: -17.5269 },
  { key: 'mahina', label: 'Mahina', coast: 'east', lng: -149.4828, lat: -17.5175 },
  { key: 'papenoo', label: "Papeno'o", coast: 'east', lng: -149.4225, lat: -17.5111 },
  { key: 'tiarei', label: "Ti'arei", coast: 'east', lng: -149.3662, lat: -17.5247 },
  { key: 'mahaena', label: "Maha'ena", coast: 'east', lng: -149.3413, lat: -17.5611 },
  { key: 'hitiaa', label: "Hitia'a", coast: 'east', lng: -149.3147, lat: -17.6022 },
  { key: 'faaone', label: 'Faaone', coast: 'east', lng: -149.2911, lat: -17.7044 },
  { key: 'taravao', label: 'Taravao', coast: 'both', lng: -149.3076, lat: -17.7361 },
]

const DESTINATION_BY_KEY = new Map<string, Destination>(
  DESTINATIONS.map((d) => [d.key, d]),
)

export function getDestination(key: string | null | undefined): Destination | null {
  if (!key) return null
  return DESTINATION_BY_KEY.get(key) ?? null
}

export function getDestinationLabel(key: string | null | undefined): string | null {
  return getDestination(key)?.label ?? null
}

export function isValidDestinationKey(key: string | null | undefined): boolean {
  return !!key && DESTINATION_BY_KEY.has(key)
}

// Options for PrimeVue Select grouped by coast.
export interface DestinationSelectGroup {
  label: string
  items: Array<{ label: string; value: string }>
}

export const DESTINATION_GROUPS: DestinationSelectGroup[] = [
  {
    label: 'Côte ouest',
    items: DESTINATIONS.filter((d) => d.coast === 'west' || d.coast === 'both').map(
      (d) => ({ label: d.label, value: d.key }),
    ),
  },
  {
    label: 'Côte est',
    items: DESTINATIONS.filter((d) => d.coast === 'east' || d.coast === 'both').map(
      (d) => ({ label: d.label, value: d.key }),
    ),
  },
]
