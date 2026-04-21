<script setup lang="ts">
import type {
  GeoJSONSource,
  Map as MapboxMap,
  MapMouseEvent,
  Popup,
} from 'mapbox-gl'
import type { FeatureCollection, Point } from 'geojson'
import { getDestinationLabel } from '~/utils/destinations'

type Mode = 'passenger' | 'driver'

const props = defineProps<{
  centerOn?: { lng: number; lat: number } | null
  selfPosition?: { lng: number; lat: number; heading?: number | null } | null
  pickMode?: boolean
  mode?: Mode
}>()

const emit = defineEmits<{
  (e: 'pick', coords: { lng: number; lat: number }): void
}>()

const drivers = useDriversStore()
const passengers = usePassengersStore()
const container = ref<HTMLDivElement | null>(null)
let map: MapboxMap | null = null
let popup: Popup | null = null
let ro: ResizeObserver | null = null
const ready = ref(false)
const hasCenteredOnSelf = ref(false)

function toDriversGeoJson(): FeatureCollection<
  Point,
  Record<string, unknown>
> {
  return {
    type: 'FeatureCollection',
    features: drivers.list.map((d) => ({
      type: 'Feature',
      properties: {
        user_id: d.user_id,
        plate: d.plate,
        model: d.model,
        color: d.color,
        direction: d.direction,
        destination_key: d.destination ?? null,
        destination_label: getDestinationLabel(d.destination),
        heading: d.heading ?? 0,
      },
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
    })),
  }
}

function toPassengersGeoJson(): FeatureCollection<
  Point,
  Record<string, unknown>
> {
  return {
    type: 'FeatureCollection',
    features: passengers.list.map((p) => ({
      type: 'Feature',
      properties: {
        user_id: p.user_id,
        direction: p.direction,
        destination_key: p.destination ?? null,
        destination_label: getDestinationLabel(p.destination),
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }
}

function toSelfGeoJson(): FeatureCollection<Point, Record<string, unknown>> {
  if (!props.selfPosition) {
    return { type: 'FeatureCollection', features: [] }
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { heading: props.selfPosition.heading ?? 0 },
        geometry: {
          type: 'Point',
          coordinates: [props.selfPosition.lng, props.selfPosition.lat],
        },
      },
    ],
  }
}

function setSource(id: string, data: FeatureCollection<Point>) {
  if (!map || !ready.value) return
  const src = map.getSource(id) as GeoJSONSource | undefined
  if (src && typeof src.setData === 'function') {
    src.setData(data)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Best-effort mapping of common French color names to a CSS color, so we can
 * render a small swatch next to the textual label. Falls back to gray when
 * the label isn't recognised — the text label is always shown so meaning
 * isn't lost.
 */
const COLOR_SWATCHES: Record<string, string> = {
  blanc: '#f8fafc',
  blanche: '#f8fafc',
  noir: '#111827',
  noire: '#111827',
  gris: '#9ca3af',
  grise: '#9ca3af',
  argent: '#cbd5e1',
  argenté: '#cbd5e1',
  rouge: '#ef4444',
  bordeaux: '#7f1d1d',
  bleu: '#3b82f6',
  bleue: '#3b82f6',
  vert: '#22c55e',
  verte: '#22c55e',
  jaune: '#facc15',
  orange: '#f97316',
  marron: '#92400e',
  beige: '#e7d6b9',
  violet: '#8b5cf6',
  violette: '#8b5cf6',
  rose: '#ec4899',
}

function colorSwatch(color: string | null): string | null {
  if (!color) return null
  const key = color.trim().toLowerCase()
  return COLOR_SWATCHES[key] ?? null
}

function buildPopupHtml(params: {
  title: string
  subtitle?: string | null
  swatch?: string | null
  destination: string | null
  direction: string | null
}): string {
  const directionLabel =
    params.direction === 'city'
      ? 'Ville'
      : params.direction === 'country'
        ? 'Campagne'
        : null
  const lines: string[] = []
  lines.push(
    `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(params.title)}</div>`,
  )
  if (params.subtitle) {
    const swatchHtml = params.swatch
      ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params.swatch};border:1px solid rgba(0,0,0,0.15);margin-right:6px;vertical-align:middle;"></span>`
      : ''
    lines.push(
      `<div style="font-size:0.8rem;color:#64748b;margin-bottom:4px;display:flex;align-items:center;">${swatchHtml}<span>${escapeHtml(
        params.subtitle,
      )}</span></div>`,
    )
  }
  lines.push(
    `<div style="font-size:0.85rem;"><strong>Destination :</strong> ${
      params.destination ? escapeHtml(params.destination) : '<em>non précisée</em>'
    }</div>`,
  )
  if (directionLabel) {
    lines.push(
      `<div style="font-size:0.75rem;color:#64748b;margin-top:2px;">Direction : ${escapeHtml(directionLabel)}</div>`,
    )
  }
  return lines.join('')
}

async function showPopupAt(
  e: MapMouseEvent & { features?: GeoJSON.Feature[] },
  kind: 'driver' | 'passenger',
) {
  if (!map) return
  const feature = e.features?.[0]
  if (!feature || feature.geometry.type !== 'Point') return
  const props_ = (feature.properties ?? {}) as Record<string, unknown>
  const coords = feature.geometry.coordinates as [number, number]
  const destination =
    typeof props_.destination_label === 'string'
      ? props_.destination_label
      : null
  const direction =
    typeof props_.direction === 'string' ? props_.direction : null

  const title =
    kind === 'driver'
      ? typeof props_.plate === 'string' && props_.plate
        ? `Voiture ${props_.plate}`
        : 'Voiture'
      : 'Passager'

  let subtitle: string | null = null
  let swatch: string | null = null
  if (kind === 'driver') {
    const model =
      typeof props_.model === 'string' && props_.model ? props_.model : null
    const color =
      typeof props_.color === 'string' && props_.color ? props_.color : null
    const parts: string[] = []
    if (model) parts.push(model)
    if (color) parts.push(color)
    subtitle = parts.length > 0 ? parts.join(' · ') : null
    swatch = colorSwatch(color)
  }

  const html = buildPopupHtml({
    title,
    subtitle,
    swatch,
    destination,
    direction,
  })

  const { $mapbox } = useNuxtApp()
  if (popup) popup.remove()
  popup = new $mapbox.Popup({ offset: 14, closeButton: true })
    .setLngLat(coords)
    .setHTML(html)
    .addTo(map)
}

function onClick(e: MapMouseEvent) {
  if (!props.pickMode) return
  emit('pick', { lng: e.lngLat.lng, lat: e.lngLat.lat })
}

async function waitForContainerSize(el: HTMLElement, timeoutMs = 2000) {
  const start = Date.now()
  while (
    (el.clientWidth === 0 || el.clientHeight === 0) &&
    Date.now() - start < timeoutMs
  ) {
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }
}

onMounted(async () => {
  const { $mapbox } = useNuxtApp()
  await nextTick()
  if (!container.value) return
  await waitForContainerSize(container.value)

  const center = props.centerOn
    ? [props.centerOn.lng, props.centerOn.lat]
    : [-149.5665, -17.5516]
  map = new $mapbox.Map({
    container: container.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: center as [number, number],
    zoom: 13,
    attributionControl: false,
  })
  map.addControl(new $mapbox.AttributionControl({ compact: true }))

  ro = new ResizeObserver(() => map?.resize())
  ro.observe(container.value)

  map.on('load', () => {
    if (!map) return

    map.addSource('drivers', { type: 'geojson', data: toDriversGeoJson() })
    map.addSource('passengers', {
      type: 'geojson',
      data: toPassengersGeoJson(),
    })
    map.addSource('self', { type: 'geojson', data: toSelfGeoJson() })

    map.addLayer({
      id: 'drivers-layer',
      type: 'circle',
      source: 'drivers',
      paint: {
        'circle-radius': 9,
        'circle-color': '#0ea5e9',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
    map.addLayer({
      id: 'drivers-label',
      type: 'symbol',
      source: 'drivers',
      layout: {
        'text-field': ['coalesce', ['get', 'plate'], ''],
        'text-size': 10,
        'text-offset': [0, 1.6],
        'text-allow-overlap': false,
      },
      paint: {
        'text-halo-color': '#fff',
        'text-halo-width': 1.4,
      },
    })
    map.addLayer({
      id: 'passengers-layer',
      type: 'circle',
      source: 'passengers',
      paint: {
        'circle-radius': 8,
        'circle-color': '#f59e0b',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })
    map.addLayer({
      id: 'self-layer',
      type: 'circle',
      source: 'self',
      paint: {
        'circle-radius': 12,
        'circle-color': '#22c55e',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 3,
      },
    })

    const setPointer = () => {
      if (!map || props.pickMode) return
      map.getCanvas().style.cursor = 'pointer'
    }
    const unsetPointer = () => {
      if (!map) return
      map.getCanvas().style.cursor = props.pickMode ? 'crosshair' : ''
    }
    map.on('mouseenter', 'drivers-layer', setPointer)
    map.on('mouseleave', 'drivers-layer', unsetPointer)
    map.on('mouseenter', 'passengers-layer', setPointer)
    map.on('mouseleave', 'passengers-layer', unsetPointer)

    map.on('click', 'drivers-layer', (e) => {
      if (props.pickMode) return
      // Drivers are only meaningful to passengers (a passenger sees nearby cars).
      if (props.mode && props.mode !== 'passenger') return
      void showPopupAt(e, 'driver')
    })
    map.on('click', 'passengers-layer', (e) => {
      if (props.pickMode) return
      // Passengers are only meaningful to drivers.
      if (props.mode && props.mode !== 'driver') return
      void showPopupAt(e, 'passenger')
    })

    ready.value = true
    map.resize()
  })

  map.on('click', onClick)
})

watch(
  () => drivers.list,
  () => setSource('drivers', toDriversGeoJson()),
  { deep: true },
)

watch(
  () => passengers.list,
  () => setSource('passengers', toPassengersGeoJson()),
  { deep: true },
)

watch(
  () => props.selfPosition,
  (pos) => {
    setSource('self', toSelfGeoJson())
    if (pos && !hasCenteredOnSelf.value && map && ready.value) {
      map.easeTo({ center: [pos.lng, pos.lat], zoom: 14, duration: 800 })
      hasCenteredOnSelf.value = true
    }
  },
  { deep: true },
)

watch(
  () => props.pickMode,
  (v) => {
    if (!map) return
    map.getCanvas().style.cursor = v ? 'crosshair' : ''
    if (v && popup) {
      popup.remove()
      popup = null
    }
  },
)

onBeforeUnmount(() => {
  if (popup) {
    popup.remove()
    popup = null
  }
  ro?.disconnect()
  ro = null
  map?.remove()
  map = null
})

defineExpose({
  recenter(pos: { lng: number; lat: number }) {
    map?.easeTo({ center: [pos.lng, pos.lat], zoom: 15, duration: 500 })
  },
  resize() {
    map?.resize()
  },
})
</script>

<template>
  <div ref="container" class="map-wrapper" />
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 300px;
}
</style>
