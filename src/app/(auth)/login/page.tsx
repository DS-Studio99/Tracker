"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error("Sign in failed", { description: error.message })
      setIsLoading(false)
      return
    }

    toast.success("Successfully signed in")
    router.push("/")
    router.refresh()
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 dark:shadow-slate-950/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Sign In</CardTitle>
        <CardDescription className="text-center">
          Enter your email and password to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required 
              className="bg-white/50 dark:bg-slate-900/50"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="pr-10 bg-white/50 dark:bg-slate-900/50"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="remember" 
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="remember" className="text-sm font-normal text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer">
              Remember me
            </Label>
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : "Sign In"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-800/50 p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Don't have an account?{" "}
          <Link href="/register" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
            Sign Up
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
