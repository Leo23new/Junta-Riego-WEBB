import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix broken default marker icons in Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

export interface MapaPredioProps {
  latitud: number | null
  longitud: number | null
  onCoordenadas?: (lat: number, lng: number) => void
  height?: string
}

// Center of Ecuador as default
const ECUADOR_CENTER: L.LatLngTuple = [-1.8312, -78.1834]
const ECUADOR_ZOOM = 7
const PUNTO_ZOOM = 14

export function MapaPredio({
  latitud,
  longitud,
  onCoordenadas,
  height = '300px',
}: MapaPredioProps) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!contenedorRef.current || mapRef.current) return

    const tieneCoords = latitud !== null && longitud !== null
    const center: L.LatLngTuple = tieneCoords
      ? [latitud as number, longitud as number]
      : ECUADOR_CENTER
    const zoom = tieneCoords ? PUNTO_ZOOM : ECUADOR_ZOOM

    const mapa = L.map(contenedorRef.current, {
      center,
      zoom,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa)

    mapRef.current = mapa

    // Place initial marker if coords exist
    if (tieneCoords) {
      const marker = L.marker([latitud as number, longitud as number], {
        draggable: !!onCoordenadas,
      }).addTo(mapa)

      if (onCoordenadas) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onCoordenadas(pos.lat, pos.lng)
        })
      }

      markerRef.current = marker
    }

    // Click handler to place/move marker
    if (onCoordenadas) {
      mapa.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(mapa)
          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            onCoordenadas(pos.lat, pos.lng)
          })
          markerRef.current = marker
        }

        onCoordenadas(lat, lng)
      })
    }

    return () => {
      mapa.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update marker position when props change externally
  useEffect(() => {
    if (!mapRef.current) return

    if (latitud !== null && longitud !== null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitud, longitud])
      } else {
        const marker = L.marker([latitud, longitud], {
          draggable: !!onCoordenadas,
        }).addTo(mapRef.current)

        if (onCoordenadas) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            onCoordenadas(pos.lat, pos.lng)
          })
        }

        markerRef.current = marker
      }

      mapRef.current.setView([latitud, longitud], PUNTO_ZOOM)
    } else {
      // No coords: remove marker if any and go back to Ecuador view
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      mapRef.current.setView(ECUADOR_CENTER, ECUADOR_ZOOM)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitud, longitud])

  return (
    <div
      ref={contenedorRef}
      style={{ height, width: '100%' }}
      className="rounded-md border border-gray-300 overflow-hidden z-0"
    />
  )
}
