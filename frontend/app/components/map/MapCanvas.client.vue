<script setup lang="ts">
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl'
import type { FeatureCollection, Point } from 'geojson'

const props = defineProps<{
  centerOn?: { lng: number; lat: number } | null
  selfPosition?: { lng: number; lat: number; heading?: number | null } | null
  pickMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'pick', coords: { lng: number; lat: number }): void
}>()

const drivers = useDriversStore()
const passengers = usePassengersStore()
const container = ref<HTMLDivElement | null>(null)
let map: MapboxMap | null = null
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
        direction: d.direction,
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
  const src = map.getSource(id)
  if (src && 'setData' in src) {
    ;(src as { setData: (d: unknown) => void }).setData(data)
  }
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
        'circle-radius': 10,
        'circle-color': '#0ea5e9',
        'circle-stroke-color': '#fff',
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
        'text-offset': [0, 1.2],
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
  },
)

onBeforeUnmount(() => {
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
