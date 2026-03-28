import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-1 text-sm text-slate-500 mb-2">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 self-start md:self-auto">
          {actions}
        </div>
      )}
    </div>
  )
}
