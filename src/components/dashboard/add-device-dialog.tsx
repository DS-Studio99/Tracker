"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { PlusCircle, Link as LinkIcon, Smartphone, CheckCircle2 } from "lucide-react"

export function AddDeviceDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [deviceName, setDeviceName] = useState("")
  const [deviceToken, setDeviceToken] = useState("")
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()

  const generateToken = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2)
      setDeviceToken(generateToken())
    } else if (step === 2) {
      if (!deviceName.trim()) {
        toast.error("Please enter a device name")
        return
      }
      addDevice()
    }
  }

  const addDevice = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from('devices')
        .insert({
          user_id: user.id,
          device_name: deviceName.trim(),
          device_token: deviceToken,
          is_online: false,
          battery_level: 0,
          is_charging: false,
          screen_status: 'off',
          status: 'pending' // Note: Ensure this exists in DB or ignore if it's implicitly pending until setup
        } as any)
        .select()
        .single()

      if (error) throw error

      toast.success("Device added successfully! Now install the app to link it.")
      setOpen(false)
      // Reset state on close
      setTimeout(() => {
        setStep(1)
        setDeviceName("")
        setDeviceToken("")
      }, 500)
      
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Failed to add device")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        className={cn(
          buttonVariants({ variant: "default" }),
          "gap-2"
        )}
      >
        <PlusCircle className="h-4 w-4" />
        Add Device
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription>
            Follow these steps to link a new Android device to your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-between mb-8 items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10">
              <div 
                className="h-full bg-blue-600 transition-all duration-300" 
                style={{ width: `${(step - 1) * 100}%` }}
              />
            </div>
            {[1, 2].map((i) => (
              <div 
                key={i} 
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white ${
                  step >= i ? "border-blue-600 text-blue-600" : "border-slate-300 text-slate-400"
                }`}
              >
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="rounded-lg bg-blue-50 p-4 flex gap-4 text-blue-900 border border-blue-100">
                <Smartphone className="h-8 w-8 text-blue-600 shrink-0" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Step 1: Download App</h4>
                  <p className="text-sm">Download and install the latest tracker APK on your target Android device.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full">
                Download Latest APK
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input 
                  id="device-name" 
                  placeholder="e.g. John's Galaxy S23" 
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Linking Token</Label>
                <div className="p-4 bg-slate-50 border rounded-md font-mono text-center text-sm break-all font-medium text-slate-800 flex items-center gap-2 justify-center">
                  <LinkIcon className="h-4 w-4 text-slate-400" />
                  {deviceToken}
                </div>
                <p className="text-xs text-slate-500 text-center mt-2">
                  Open the app on the target device and enter this token.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && (
             <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={loading}>
              Back
             </Button>
          )}
          <Button onClick={handleNextStep} disabled={loading || (step === 2 && !deviceName.trim())}>
            {step === 2 ? (loading ? "Creating..." : "Create Device") : "Next Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
