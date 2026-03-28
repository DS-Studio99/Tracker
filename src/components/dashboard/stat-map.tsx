"use client"

import { useEffect, useRef } from "react"

interface Props {
  locations: Array<{ lat: number; lng: number }>
}

export default function StatMap({ locations }: Props) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return
    if (mapRef.current) return

    import("leaflet").then(L => {
      // Fix default icons if standard markers are used
      ;(L.Icon.Default.prototype as any)._getIconUrl = undefined
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const center: [number, number] = locations.length > 0 
        ? [locations[0].lat, locations[0].lng] 
        : [23.8103, 90.4125]

      const map = L.map(mapContainerRef.current!, {
        center,
        zoom: locations.length > 0 ? 12 : 3,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map)

      // Heatmap requires leaflet.heat or we can just draw circles
      // For simplicity and avoiding extra plugins, we draw 
      // small translucent circles which cluster visually to form a heatmap.
      
      const bounds = L.latLngBounds([])
      locations.forEach(loc => {
        const pt = L.latLng(loc.lat, loc.lng)
        L.circleMarker(pt, {
          radius: 5,
          color: "transparent",
          fillColor: "#ef4444", // red
          fillOpacity: 0.3
        }).addTo(map)
        bounds.extend(pt)
      })

      if (locations.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 })
      }

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [locations])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div 
        ref={mapContainerRef} 
        className="w-full h-full min-h-[300px] rounded-lg border border-slate-200 dark:border-slate-800 z-0 relative"
      />
    </>
  )
}
