"use client"

import { toast as sonnerToast } from "sonner"

export type ToastProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  duration?: number
  action?: React.ReactNode
}

/**
 * A wrapper around Sonner to maintain compatibility with shadcn/ui typical `use-toast` interface
 * so we don't have to rewrite imports everywhere in the dashboard.
 */
export function toast(props: ToastProps | string) {
  if (typeof props === "string") {
    return sonnerToast(props)
  }

  const { title, description, variant, duration, ...rest } = props

  const options: any = { description, duration, ...rest }

  if (variant === "destructive") {
    return sonnerToast.error(title as any, options)
  }

  return sonnerToast(title as any, options)
}

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  }
}
