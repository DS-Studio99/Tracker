"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/utils/constants";
import * as Icons from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  // Flatten nav items for search
  const flatNavItems = NAV_ITEMS.flatMap((section) => 
    section.items.map(item => ({ ...item, section: section.section }))
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {flatNavItems.map((item) => {
            const Icon = (Icons as any)[item.icon] || Icons.Circle;
            return (
              <CommandItem
                key={item.href}
                value={`${item.title} ${item.section}`}
                onSelect={() => runCommand(() => router.push(item.href))}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-slate-500" />
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  <span className="text-xs text-slate-400">{item.section}</span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))} className="cursor-pointer">
            <Icons.Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/commands'))} className="cursor-pointer">
            <Icons.Terminal className="mr-2 h-4 w-4" />
            <span>Send Remote Command</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
