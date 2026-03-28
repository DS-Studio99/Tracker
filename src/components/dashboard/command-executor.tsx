"use client"

import { useRef, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"
import { RemoteCommand } from "@/lib/types/database"

export type CommandResult = {
  status: "executed" | "failed" | "timeout"
  result?: any
  result_media_url?: string | null
}

export type ExecuteCommandOptions = {
  device_id: string
  command_type: string
  parameters?: Record<string, any>
  onStatusChange?: (status: RemoteCommand["status"]) => void
  onResult?: (result: CommandResult) => void
  timeoutMs?: number
}

export function useCommandExecutor() {
  const { toast } = useToast()
  const activeChannels = useRef<Map<string, ReturnType<ReturnType<typeof createClient>["channel"]>>>(new Map())

  const executeCommand = useCallback(async ({
    device_id,
    command_type,
    parameters = {},
    onStatusChange,
    onResult,
    timeoutMs = 60000,
  }: ExecuteCommandOptions): Promise<string | null> => {
    const supabase = createClient()

    const toastId = `cmd-${Date.now()}`

    toast({
      title: "⏳ Sending Command...",
      description: `${command_type.replace(/_/g, " ")} → sending to device`,
    })

    const { data: cmd, error } = await supabase
      .from("remote_commands")
      .insert({
        device_id,
        command_type,
        parameters,
        status: "pending",
      } as any)
      .select()
      .single() as any

    if (error || !cmd) {
      toast({
        title: "❌ Command Failed",
        description: "Could not send command to device.",
        variant: "destructive",
      })
      return null
    }

    const cmdId: string = cmd.id
    let settled = false

    const timeoutHandle = setTimeout(() => {
      if (settled) return
      settled = true
      channel.unsubscribe()
      activeChannels.current.delete(cmdId)
      toast({
        title: "⏰ Command Timed Out",
        description: `No response after ${timeoutMs / 1000}s. Device may be offline.`,
        variant: "destructive",
      })
      onResult?.({ status: "timeout" })
    }, timeoutMs)

    const channel = supabase
      .channel(`cmd-status-${cmdId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "remote_commands",
          filter: `id=eq.${cmdId}`,
        },
        (payload) => {
          if (settled) return
          const updated = payload.new as RemoteCommand
          onStatusChange?.(updated.status)

          if (updated.status === "delivered") {
            toast({
              title: "📲 Command Received",
              description: "Device received the command and is executing...",
            })
          } else if (updated.status === "executed") {
            settled = true
            clearTimeout(timeoutHandle)
            channel.unsubscribe()
            activeChannels.current.delete(cmdId)

            toast({
              title: "✅ Command Executed",
              description: `${command_type.replace(/_/g, " ")} completed successfully.`,
            })

            onResult?.({
              status: "executed",
              result: updated.result,
              result_media_url: updated.result_media_url,
            })
          } else if (updated.status === "failed") {
            settled = true
            clearTimeout(timeoutHandle)
            channel.unsubscribe()
            activeChannels.current.delete(cmdId)

            toast({
              title: "❌ Command Failed",
              description: updated.result?.error || "Device reported execution failure.",
              variant: "destructive",
            })

            onResult?.({
              status: "failed",
              result: updated.result,
            })
          }
        }
      )
      .subscribe()

    activeChannels.current.set(cmdId, channel)
    return cmdId
  }, [toast])

  const cleanup = useCallback(() => {
    activeChannels.current.forEach((ch) => ch.unsubscribe())
    activeChannels.current.clear()
  }, [])

  return { executeCommand, cleanup }
}
