import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export default defineNuxtPlugin(() => {
  const {
    public: { mapboxToken },
  } = useRuntimeConfig()
  mapboxgl.accessToken = mapboxToken
  return { provide: { mapbox: mapboxgl } }
})
