"use client"

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { formatRelative } from '@/lib/utils/format'

// Fix typical Leaflet missing icon issues in Next.js
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

interface MiniMapProps {
  lat: number
  lng: number
  address?: string
  timestamp?: string
}

export default function MiniMap({ lat, lng, address, timestamp }: MiniMapProps) {
  useEffect(() => {
    // Leaflet global fix for Next.js SSR
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  if (!lat || !lng) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-900/50 rounded-md text-slate-500">
        No location data available
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 isolate">
      <MapContainer 
        center={[lat, lng]} 
        zoom={14} 
        scrollWheelZoom={false} 
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={customIcon}>
          <Popup>
            <div className="text-sm p-1">
              <p className="font-semibold">{address || "Last Known Location"}</p>
              {timestamp && <p className="text-xs text-slate-500 mt-1">Updated {formatRelative(timestamp)}</p>}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
