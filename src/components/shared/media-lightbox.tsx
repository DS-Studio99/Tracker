"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { formatFileSize, formatDuration } from "@/lib/utils/format"
import { MediaFile } from "@/lib/types/database"
import { MapWrapper } from "@/components/maps/map-wrapper"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  MapPin,
  Camera,
  FileImage,
  Film,
  Calendar,
  HardDrive,
  Maximize
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MediaLightboxProps {
  isOpen: boolean
  items: MediaFile[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function MediaLightbox({ isOpen, items, currentIndex, onClose, onNavigate }: MediaLightboxProps) {
  const [showInfo, setShowInfo] = useState(true)

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") handlePrev()
      if (e.key === "ArrowRight") handleNext()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentIndex, items.length])

  // Scroll to block body scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
    return () => {
      document.body.style.overflow = "auto"
    }
  }, [isOpen])

  if (!isOpen || items.length === 0 || currentIndex < 0 || currentIndex >= items.length) {
    return null
  }

  const currentItem = items[currentIndex]

  const handlePrev = () => {
    if (currentIndex > 0) onNavigate(currentIndex - 1)
  }

  const handleNext = () => {
    if (currentIndex < items.length - 1) onNavigate(currentIndex + 1)
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(currentItem.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = currentItem.file_name || `download_${currentItem.id}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download file:", error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/60 to-transparent">
        <div className="text-white text-sm font-medium bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
          {currentIndex + 1} / {items.length}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 hover:text-white rounded-full bg-black/20"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("text-white hover:bg-white/20 hover:text-white rounded-full bg-black/20", showInfo && "bg-white/20")}
            onClick={() => setShowInfo(!showInfo)}
            title="Toggle Info"
          >
            <Info className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-red-500/80 hover:text-white rounded-full bg-black/20 ml-2"
            onClick={onClose}
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hover:text-white rounded-full h-12 w-12 z-50 bg-black/20"
          onClick={handlePrev}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      
      {currentIndex < items.length - 1 && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hover:text-white rounded-full h-12 w-12 z-50 transition-all bg-black/20"
          style={{ right: showInfo ? '340px' : '16px' }}
          onClick={handleNext}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Main Content Area */}
      <div className={cn("flex-1 h-full flex items-center justify-center p-8 transition-all duration-300", showInfo ? "mr-80" : "mr-0")}>
        {currentItem.file_type === 'video' ? (
          <video 
            src={currentItem.file_url} 
            controls 
            autoPlay
            className="max-h-full max-w-full rounded-md shadow-2xl object-contain"
          />
        ) : (
          <img 
            src={currentItem.file_url} 
            alt={currentItem.file_name || "Media file"} 
            className="max-h-full max-w-full rounded-md shadow-2xl object-contain shrink-0"
            loading="lazy"
          />
        )}
      </div>

      {/* Sidebar Info Panel */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-950 border-l dark:border-slate-800 transition-transform duration-300 flex flex-col shadow-xl z-40",
          showInfo ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between mt-14">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {currentItem.file_type === 'video' ? <Film className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}
            File Details
          </h3>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Metadata section */}
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">File Name</span>
                <span className="font-medium break-all">{currentItem.file_name || "Unknown"}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1 flex items-center gap-1"><HardDrive className="h-3 w-3" /> Size</span>
                  <span className="font-medium">{currentItem.file_size ? formatFileSize(currentItem.file_size) : "--"}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1 flex items-center gap-1"><Maximize className="h-3 w-3" /> Dimensions</span>
                  <span className="font-medium">
                    {currentItem.width && currentItem.height ? `${currentItem.width} × ${currentItem.height}` : "--"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Date Taken/Created</span>
                <span className="font-medium">
                  {currentItem.file_timestamp ? format(new Date(currentItem.file_timestamp), "PPP p") : format(new Date(currentItem.created_at), "PPP p")}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1 flex items-center gap-1"><Camera className="h-3 w-3" /> Source</span>
                <Badge variant="secondary" className="capitalize">{currentItem.source || "Unknown"}</Badge>
              </div>

              {currentItem.file_type === 'video' && currentItem.duration && (
                <div>
                  <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Duration</span>
                  <span className="font-medium">{formatDuration(currentItem.duration)}</span>
                </div>
              )}
            </div>

            <Separator className="dark:border-slate-800" />

            {/* Map section */}
            {currentItem.latitude && currentItem.longitude ? (
              <div className="space-y-2">
                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location Tag
                </span>
                <div className="h-40 rounded-lg overflow-hidden border">
                  <MapWrapper 
                    locations={[
                      {
                        id: currentItem.id,
                        device_id: currentItem.device_id,
                        latitude: currentItem.latitude,
                        longitude: currentItem.longitude,
                        timestamp: currentItem.file_timestamp || currentItem.created_at,
                        is_mock: false,
                        accuracy: null,
                        speed: null,
                        altitude: null,
                        bearing: null,
                        address: null,
                        provider: null,
                        battery_level: null,
                        created_at: currentItem.created_at
                      }
                    ]} 
                    zoom={15} 
                    showPath={false} 
                  />
                </div>
                <div className="text-xs text-slate-500 flex justify-between">
                  <span>Lat: {currentItem.latitude.toFixed(6)}</span>
                  <span>Lng: {currentItem.longitude.toFixed(6)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 border border-dashed rounded-lg">
                <MapPin className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No GPS location data found for this file.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
