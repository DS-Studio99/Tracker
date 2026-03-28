"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/utils/constants";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button, buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAlertStore } from "@/lib/stores/alert-store";

interface SidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (val: boolean) => void;
}

const Icon = ({ name, className }: { name: string; className?: string }) => {
  const LucideIcon = (Icons as any)[name] || Icons.Circle;
  return <LucideIcon className={className} />;
};

export function Sidebar({ isMobile, onNavigate, isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const unreadCount = useAlertStore((state) => state.unreadAlertCount);
  const [socialExpanded, setSocialExpanded] = useState(false);

  // Auto-expand Social Media if active route is social
  useEffect(() => {
    if (pathname.startsWith("/social")) {
      setSocialExpanded(true);
    }
  }, [pathname]);

  return (
    <div className={cn("flex flex-col h-full bg-slate-950 text-slate-300 transition-all duration-300 border-r border-slate-800", isCollapsed ? "w-[64px]" : "w-[240px]")}>
      
      {/* Brand Header */}
      <div className="flex h-16 items-center flex-shrink-0 px-4 pt-2 border-b border-slate-800/50">
        <Icons.MonitorSmartphone className="h-6 w-6 text-emerald-500 mr-2 flex-shrink-0" />
        {!isCollapsed && <span className="font-bold text-lg text-slate-50 tracking-tight whitespace-nowrap overflow-hidden">Tracker Pro</span>}
      </div>

      <ScrollArea className="flex-1 min-h-0 py-4">
        <nav className="space-y-6 px-2">
          {NAV_ITEMS.map((section, idx) => {
            const isSocial = section.section === "Social Media";
            
            const renderItems = (items: typeof section.items) => (
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={onNavigate}>
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative group",
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "hover:bg-slate-800 hover:text-slate-50 text-slate-400"
                        )}
                        title={isCollapsed ? item.title : undefined}
                      >
                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-r-full" />}
                        <Icon name={item.icon} className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-emerald-500" : "")} />
                        
                        {!isCollapsed && (
                          <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.title}</span>
                        )}

                        {!isCollapsed && item.badge && unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );

            return (
              <div key={idx} className={cn("px-2", isCollapsed ? "flex flex-col items-center" : "")}>
                {!isCollapsed && (
                  <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {section.section}
                  </h4>
                )}

                {isSocial && !isCollapsed ? (
                  <Collapsible open={socialExpanded} onOpenChange={setSocialExpanded} className="space-y-1">
                    <CollapsibleTrigger 
                      className={cn(
                        buttonVariants({ variant: "ghost" }), 
                        "w-full flex items-center justify-between px-3 py-2 h-auto text-slate-400 hover:bg-slate-800 hover:text-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <Icons.MessageCircle className="h-4 w-4" />
                        <span>{section.section}</span>
                      </div>
                      <Icons.ChevronDown className={cn("h-4 w-4 transition-transform", socialExpanded && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1 transition-all">
                      {renderItems(section.items)}
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  renderItems(isSocial && isCollapsed ? [section.items[0]] : section.items) 
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-slate-700">
            <AvatarImage src="" />
            <AvatarFallback className="bg-slate-800 text-slate-300">AD</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-sm font-medium text-slate-200">Admin User</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Administrator</span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-400/10" title="Logout">
            <Icons.LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
