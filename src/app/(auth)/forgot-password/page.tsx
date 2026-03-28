"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast.error("Please enter your email address")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/update-password`,
    })

    setIsLoading(false)

    if (error) {
      toast.error("Failed to send reset email", { description: error.message })
      return
    }

    setIsSuccess(true)
    toast.success("Password reset email sent")
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 dark:shadow-slate-950/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
        <CardDescription className="text-center">
          Enter your email address to receive a secure password reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-center border border-emerald-100 dark:border-emerald-500/20">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Check your inbox</h3>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-300">
              We've sent a password reset link to <span className="font-semibold">{email}</span>
            </p>
          </div>
        ) : (
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
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Link...
                </>
              ) : "Send Reset Link"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-800/50 p-4">
        <Link href="/login" className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  )
}
