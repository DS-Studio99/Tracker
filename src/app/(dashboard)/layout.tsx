"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSupabaseRealtime } from "@/lib/hooks/use-supabase-realtime";
import { useDeviceStore } from "@/lib/stores/device-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { toast } from "sonner";

// Create a client for React Query
const queryClient = new QueryClient();

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Realtime alerts listener
  const selectedDeviceId = useDeviceStore((state) => state.selectedDeviceId);
  const incrementAlertCount = useAlertStore((state) => state.incrementAlertCount);

  useSupabaseRealtime(
    "alerts",
    selectedDeviceId ? { column: "device_id", value: selectedDeviceId } : undefined,
    (payload) => {
      // On new alert inserted
      incrementAlertCount();
      const newAlert = payload.new;
      toast.error(newAlert.title, {
        description: newAlert.description,
      });
    }
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-slate-50 dark:bg-[#09090b] overflow-hidden">
        
        {/* Desktop Sidebar (hidden on mobile) */}
        <div className={`hidden lg:block h-full transition-all duration-300 z-20 shadow-xl shadow-slate-900/10`}>
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            setIsCollapsed={setIsSidebarCollapsed} 
          />
        </div>

        {/* Main Interface Content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
          <Header 
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            isDesktopCollapsed={isSidebarCollapsed} 
          />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto w-full relative">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
              {children}
            </div>
          </main>
        </div>

        {/* Sonner Toast Notifications built by shadcn */}
        <Toaster position="top-right" expand={false} richColors />
      </div>
    </QueryClientProvider>
  );
}
