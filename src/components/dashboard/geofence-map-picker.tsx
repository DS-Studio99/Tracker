"use client"

import { useEffect, useRef, useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

interface Props {
  center?: [number, number]
  radius?: number
  onCenterChange?: (lat: number, lng: number) => void
  onRadiusChange?: (radius: number) => void
  readOnly?: boolean
}

export default function GeofenceMapPicker({
  center = [23.8103, 90.4125],
  radius = 500,
  onCenterChange,
  onRadiusChange,
  readOnly = false,
}: Props) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)

  const [localRadius, setLocalRadius] = useState(radius)

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return
    if (mapRef.current) return // already initialised

    // Dynamically import Leaflet only on client
    import("leaflet").then((L) => {
      // Fix default icon paths
      ;(L.Icon.Default.prototype as any)._getIconUrl = undefined
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(mapContainerRef.current!, {
        center: center as [number, number],
        zoom: 14,
        zoomControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map)

      const marker = L.marker(center as [number, number], { draggable: !readOnly }).addTo(map)
      const circle = L.circle(center as [number, number], { radius: localRadius, color: "#6366f1", fillOpacity: 0.15 }).addTo(map)

      markerRef.current = marker
      circleRef.current = circle
      mapRef.current = map

      if (!readOnly) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng()
          circle.setLatLng(pos)
          onCenterChange?.(pos.lat, pos.lng)
        })

        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng)
          circle.setLatLng(e.latlng)
          onCenterChange?.(e.latlng.lat, e.latlng.lng)
        })
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update circle radius reactively
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(localRadius)
    }
  }, [localRadius])

  const handleRadius = (val: number | readonly number[]) => {
    const r = Array.isArray(val) ? (val as number[])[0] : (val as number)
    setLocalRadius(r)
    onRadiusChange?.(r)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div
        ref={mapContainerRef}
        className="w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800"
        style={{ height: 280 }}
      />

      {!readOnly && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-slate-600 dark:text-slate-400">Radius</Label>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {localRadius >= 1000 ? `${(localRadius / 1000).toFixed(1)} km` : `${localRadius} m`}
            </span>
          </div>
          <Slider
            min={100}
            max={5000}
            step={100}
            value={[localRadius]}
            onValueChange={handleRadius}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>100m</span><span>5km</span>
          </div>
        </div>
      )}
    </div>
  )
}
