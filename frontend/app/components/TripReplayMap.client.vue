<script setup lang="ts">
import type { LineString } from 'geojson'
import type {
  GeoJSONSource,
  Map as MapboxMap,
  Marker,
} from 'mapbox-gl'

/**
 * Read-only display of a recorded trip route. Receives a GeoJSON
 * `LineString` (already chronologically sorted) and renders:
 *   - the polyline,
 *   - a green pickup marker on the first point,
 *   - a red dropoff marker on the last point,
 *   - the camera fitted to the bounding box.
 *
 * Intentionally lighter than `MapCanvas.client.vue` (no live drivers,
 * popups or interactions) so the admin trip detail page loads fast and
 * stays predictable.
 */
const props = defineProps<{
  geometry: LineString | null
  height?: string
}>()

const container = ref<HTMLDivElement | null>(null)
let map: MapboxMap | null = null
const markers: Marker[] = []
const ready = ref(false)
const empty = computed(
  () => !props.geometry || props.geometry.coordinates.length < 2,
)

const SOURCE_ID = 'trip-route'
const LAYER_ID = 'trip-route-layer'

function disposeMarkers() {
  for (const m of markers) m.remove()
  markers.length = 0
}

function fitBounds() {
  if (!map || !props.geometry) return
  const coords = props.geometry.coordinates
  const first = coords[0]
  if (!first) return
  let minLng = first[0] as number
  let maxLng = first[0] as number
  let minLat = first[1] as number
  let maxLat = first[1] as number
  for (const c of coords) {
    const lng = c[0] as number
    const lat = c[1] as number
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 40, duration: 0, maxZoom: 16 },
  )
}

function applyGeometry() {
  if (!map || !ready.value || !props.geometry) return
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
  const data = {
    type: 'Feature' as const,
    geometry: props.geometry,
    properties: {},
  }
  if (src) {
    src.setData(data)
  } else {
    map.addSource(SOURCE_ID, { type: 'geojson', data })
    map.addLayer({
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 4,
        'line-opacity': 0.85,
      },
    })
  }
  disposeMarkers()
  const coords = props.geometry.coordinates
  if (coords.length >= 1) {
    const { $mapbox } = useNuxtApp()
    const start = coords[0] as [number, number]
    const end = coords[coords.length - 1] as [number, number]
    markers.push(
      new $mapbox.Marker({ color: '#22c55e' }).setLngLat(start).addTo(map),
    )
    if (coords.length > 1) {
      markers.push(
        new $mapbox.Marker({ color: '#ef4444' }).setLngLat(end).addTo(map),
      )
    }
  }
  fitBounds()
}

onMounted(async () => {
  const { $mapbox } = useNuxtApp()
  await nextTick()
  if (!container.value) return
  map = new $mapbox.Map({
    container: container.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-149.5665, -17.6509],
    zoom: 10,
    interactive: true,
    attributionControl: true,
  })
  map.addControl(new $mapbox.NavigationControl({ showCompass: false }))
  map.on('load', () => {
    ready.value = true
    applyGeometry()
  })
})

watch(
  () => props.geometry,
  () => {
    applyGeometry()
  },
)

onBeforeUnmount(() => {
  disposeMarkers()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="trip-replay">
    <div ref="container" class="trip-replay-canvas" :style="{ height: height || '360px' }" />
    <div v-if="empty" class="trip-replay-overlay">
      <i class="pi pi-map" />
      <span>Aucun point GPS enregistré pour ce trajet.</span>
    </div>
  </div>
</template>

<style scoped>
.trip-replay {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}
.trip-replay-canvas {
  width: 100%;
}
.trip-replay-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  font-size: 0.95rem;
}
.trip-replay-overlay i {
  font-size: 2rem;
}
</style>
