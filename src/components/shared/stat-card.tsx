import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    isUp: boolean
  }
  color?: string
  onClick?: () => void
}

export function StatCard({ title, value, icon, trend, color, onClick }: StatCardProps) {
  const isClickable = !!onClick

  return (
    <Card 
      className={cn(
        "transition-all duration-200 shadow-sm hover:shadow-md",
        isClickable ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5" : ""
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-full", color ? color : "bg-primary/10 text-primary")}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="flex items-center text-xs mt-1">
            <span className={cn("flex items-center font-medium", trend.isUp ? "text-emerald-500" : "text-rose-500")}>
              {trend.isUp ? <ArrowUpIcon className="mr-1 h-3 w-3" /> : <ArrowDownIcon className="mr-1 h-3 w-3" />}
              {trend.value}%
            </span>
            <span className="text-muted-foreground ml-1">from last month</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
