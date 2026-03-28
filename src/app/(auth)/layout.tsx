import { MonitorSmartphone } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b] relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute top-0 w-full h-full overflow-hidden z-0 flex justify-center items-center pointer-events-none">
        <div className="absolute w-[800px] h-[800px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl -top-40 -left-20 animate-pulse mix-blend-screen" />
        <div className="absolute w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl bottom-0 -right-20 animate-pulse mix-blend-screen" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 py-8 mx-auto flex flex-col items-center">
        <Link href="/" className="flex flex-col items-center justify-center mb-8 gap-2 group">
          <div className="h-12 w-12 bg-slate-900 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
            <MonitorSmartphone className="h-7 w-7 text-white dark:text-emerald-500" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Mobile Tracker</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Monitor your devices securely</p>
          </div>
        </Link>
        
        {children}
      </div>
    </div>
  )
}
