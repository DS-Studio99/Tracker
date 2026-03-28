import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DetailSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function DetailSheet({ isOpen, onClose, title, description, children }: DetailSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 flex flex-col bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800">
        <SheetHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <SheetTitle className="text-xl">{title}</SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1 p-6">
          <div className="pb-10">
            {children}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
