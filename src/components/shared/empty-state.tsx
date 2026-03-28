import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center min-h-[300px] border border-dashed rounded-lg bg-slate-50 dark:bg-slate-950 dark:border-slate-800", className)}>
      {icon && (
        <div className="mb-4 text-slate-400 bg-white dark:bg-slate-900 p-4 rounded-full shadow-sm border dark:border-slate-800">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
