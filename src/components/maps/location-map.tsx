"use client"

import React, { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { format } from "date-fns"
import { Battery, Activity, Clock, Navigation, Wifi } from "lucide-react"
import { MapWrapperProps } from "./map-wrapper"

// Custom controller to update map view when center changes or fit all markers
function MapController({ center, zoom, liveMode, locations }: { center?: [number, number], zoom?: number, liveMode?: boolean, locations: any[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (center && liveMode) {
      map.setView(center, zoom || 16, { animate: true })
    } else if (locations.length > 0 && !liveMode && !center) {
      const validPoints = locations
        .filter(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
        .map(loc => [loc.latitude, loc.longitude] as [number, number])
        
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints)
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] })
        }
      }
    } else if (center) {
      map.setView(center, zoom || 15)
    }
  }, [center, zoom, liveMode, map, locations])

  return null
}

export function LocationMap({ 
  locations, 
  center, 
  zoom = 13, 
  showPath = true, 
  liveMode = false,
  geofences = [],
  latestLocationId
}: MapWrapperProps) {
  
  // Custom marker icon moved inside component to prevent SSR 'window is not defined' crash
  const pulsatingIcon = React.useMemo(() => {
    return new L.DivIcon({
      className: 'custom-pulsating-marker',
      html: `<div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_0_4px_rgba(59,130,246,0.3)] animate-pulse"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }, [])

  // Create path coordinates
  const pathCoords = locations
    .filter(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
    .map(loc => [loc.latitude, loc.longitude] as [number, number])

  if (locations.length === 0 && !center) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-lg border">
        <div className="flex flex-col items-center">
          <Navigation className="h-10 w-10 mb-2 opacity-50" />
          <p>No location data available for this range.</p>
        </div>
      </div>
    )
  }

  const defaultCenter = center || (locations.length > 0 ? [locations[0].latitude, locations[0].longitude] as [number, number] : [0, 0] as [number, number])

  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border bg-slate-100 dark:bg-slate-900 relative">
      <MapContainer 
        center={defaultCenter} 
        zoom={zoom} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} zoom={zoom} liveMode={liveMode} locations={locations} />

        {/* Draw Geofences */}
        {geofences.map(zone => (
          <Circle 
            key={zone.id}
            center={[zone.latitude, zone.longitude]}
            radius={zone.radius}
            pathOptions={{ 
              color: zone.type === 'safe' ? '#10b981' : '#ef4444', 
              fillColor: zone.type === 'safe' ? '#10b981' : '#ef4444',
              fillOpacity: 0.2,
              weight: 2
            }}
          >
            <Popup>
              <div className="text-center font-medium capitalize">{zone.name} ({zone.type} Zone)</div>
            </Popup>
          </Circle>
        ))}

        {/* Draw Path */}
        {showPath && pathCoords.length > 1 && (
          <Polyline 
            positions={pathCoords} 
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.6 }} 
          />
        )}

        {/* Draw Markers */}
        {locations.map((loc) => {
          const isLatest = loc.id === latestLocationId || (locations.length > 0 && loc.id === locations[0].id)
          
          return (
            <React.Fragment key={loc.id}>
              {/* Accuracy Circle */}
              {loc.accuracy && loc.accuracy < 200 && ( // Hide massive accuracy circles
                <Circle 
                  center={[loc.latitude, loc.longitude]}
                  radius={loc.accuracy}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}
                />
              )}
              
              <Marker 
                position={[loc.latitude, loc.longitude]}
                icon={isLatest && liveMode ? pulsatingIcon : undefined}
              >
                <Popup className="custom-popup">
                  <div className="p-1 space-y-2 min-w-[200px]">
                    <div className="font-semibold text-sm border-b pb-1 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      {(() => {
                        const date = new Date(loc.timestamp)
                        return isNaN(date.getTime()) ? 'Invalid Time' : format(date, "MMM d, yyyy h:mm:ss a")
                      })()}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded">
                        <span className="text-slate-500 flex items-center gap-1"><Battery className="h-3 w-3" /> Battery</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{loc.battery_level || '--'}%</span>
                      </div>
                      <div className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded">
                        <span className="text-slate-500 flex items-center gap-1"><Activity className="h-3 w-3" /> Speed</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{loc.speed ? `${Math.round(loc.speed * 3.6)} km/h` : '--'}</span>
                      </div>
                      <div className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded">
                        <span className="text-slate-500 flex items-center gap-1"><Navigation className="h-3 w-3" /> Accuracy</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{loc.accuracy ? `±${Math.round(loc.accuracy)}m` : '--'}</span>
                      </div>
                      <div className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded">
                        <span className="text-slate-500 flex items-center gap-1"><Wifi className="h-3 w-3" /> Provider</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">{loc.provider || 'GPS'}</span>
                      </div>
                    </div>
                    
                    {loc.is_mock && (
                      <div className="mt-2 text-xs text-center p-1 bg-red-100 text-red-600 rounded font-medium">
                        Mock Location Detected
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          )
        })}
      </MapContainer>
      
      {/* Required style to stop Leaflet popups from breaking generic Tailwind styles */}
      <style>{`
        .leaflet-popup-content p { margin: 0; }
        .custom-pulsating-marker { background: transparent; border: none; }
      `}</style>
    </div>
  )
}
