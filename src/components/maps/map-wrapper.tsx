"use client"

import { MapSkeleton } from "@/components/shared/loading-skeleton"
import { Location } from "@/lib/types/database"
import dynamic from "next/dynamic"
import type { ComponentType } from "react"

export interface GeofenceZone {
  id: string
  name: string
  type: "safe" | "restricted"
  latitude: number
  longitude: number
  radius: number
}

export interface MapWrapperProps {
  locations: Location[]
  center?: [number, number]
  zoom?: number
  showPath?: boolean
  liveMode?: boolean
  geofences?: GeofenceZone[]
  latestLocationId?: string
}

// Dynamic import — this cast ensures the correct prop types are preserved
const LocationMapDynamic = dynamic<MapWrapperProps>(
  () => import("./location-map").then((mod) => mod.LocationMap as ComponentType<MapWrapperProps>),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
)

export function MapWrapper(props: MapWrapperProps) {
  return <LocationMapDynamic {...props} />
}
