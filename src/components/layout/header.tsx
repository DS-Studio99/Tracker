"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuGroup,
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import * as Icons from "lucide-react";
import { Sidebar } from "./sidebar";
import { DeviceSelector } from "./device-selector";
import { SearchDialog } from "./search-dialog";
import { useAlertStore } from "@/lib/stores/alert-store";
import { cn } from "@/lib/utils";

export function Header({ toggleSidebar, isDesktopCollapsed }: { toggleSidebar: () => void, isDesktopCollapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadAlerts = useAlertStore((state) => state.unreadAlertCount);

  // Auto-generate title based on pathname
  const generateTitle = () => {
    if (pathname === '/') return 'Dashboard';
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Dashboard';
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, ' ');
  };

  return (
    <>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-white dark:bg-slate-950 px-4 shadow-sm dark:shadow-none dark:border-slate-800">
        
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger 
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }), 
                  "h-9 w-9"
                )}
              >
                <Icons.Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[240px] bg-slate-950 border-r-slate-800">
                <Sidebar isMobile onNavigate={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Sidebar Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden lg:flex h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            <Icons.Menu className="h-5 w-5" />
          </Button>
          
          <div className="hidden sm:block">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {generateTitle()}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
          <DeviceSelector />

          {/* Search Button */}
          <Button 
            variant="outline" 
            className="hidden md:flex relative h-9 w-9 sm:w-64 justify-start text-sm text-slate-500 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
            onClick={() => setSearchOpen(true)}
          >
            <Icons.Search className="sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline-flex">Search anything...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-white dark:bg-slate-950 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex dark:border-slate-700">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSearchOpen(true)}>
            <Icons.Search className="h-5 w-5" />
          </Button>

          {/* Alerts/Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9 text-slate-600 dark:text-slate-400">
            <Icons.Bell className="h-5 w-5 transition-transform hover:scale-110" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </Button>

          {/* Theme Toggle (Placeholder icon) */}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600 dark:text-slate-400 hidden sm:flex">
            <Icons.Moon className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger 
              className={cn(
                buttonVariants({ variant: "ghost" }), 
                "relative h-9 w-9 rounded-full"
              )}
            >
              <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-800 transition-opacity hover:opacity-80">
                <AvatarImage src="/avatars/01.png" alt="@admin" />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">AD</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Admin User</p>
                    <p className="text-xs leading-none text-slate-500 dark:text-slate-400">
                      admin@tracker.com
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/account")}>
                <Icons.User className="mr-2 h-4 w-4" />
                <span>My Account</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/device-settings")}>
                <Icons.Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950"
                onClick={async () => {
                  const { createClient } = await import("@/lib/supabase/client")
                  const sup = createClient()
                  await sup.auth.signOut()
                  router.push("/auth/login")
                }}
              >
                <Icons.LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>
    </>
  );
}
