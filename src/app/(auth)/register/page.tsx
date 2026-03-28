"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreed, setAgreed] = useState(false)

  // Password strength logic
  const getPasswordStrength = () => {
    let strength = 0;
    if (password.length > 5) strength += 1;
    if (password.length > 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  }
  
  const strength = getPasswordStrength();
  const strengthLabels = ["Weak", "Weak", "Fair", "Good", "Strong", "Strong"];
  const strengthColors = ["bg-slate-200", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!fullName || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (!agreed) {
      toast.error("You must agree to the Terms of Service")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'user'
        },
        emailRedirectTo: `${location.origin}/auth/callback`
      }
    })

    if (error) {
      toast.error("Registration failed", { description: error.message })
      setIsLoading(false)
      return
    }

    toast.success("Account created successfully", { 
      description: "Please check your email to verify your account."
    })
    router.push("/login")
  }

  return (
    <Card className="w-full border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 dark:shadow-slate-950/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Create an account</CardTitle>
        <CardDescription className="text-center">
          Enter your details below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              placeholder="John Doe" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              required 
              className="bg-white/50 dark:bg-slate-900/50"
            />
          </div>
          
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
            <Label htmlFor="password">Password</Label>
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
            
            {/* Password Strength Indicator */}
            {password && (
              <div className="space-y-1 mt-2">
                <div className="flex gap-1 h-1.5 w-full">
                  {[1, 2, 3, 4].map((level) => (
                    <div 
                      key={level} 
                      className={`h-full flex-1 rounded-full transition-colors ${strength >= level ? strengthColors[strength] : 'bg-slate-200 dark:bg-slate-800'}`} 
                    />
                  ))}
                </div>
                <p className="text-xs text-right text-slate-500 font-medium">
                  {strengthLabels[strength]}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input 
              id="confirm-password" 
              type={showPassword ? "text" : "password"} 
              placeholder="••••••••" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              className="bg-white/50 dark:bg-slate-900/50"
            />
            {password && confirmPassword && password === confirmPassword && (
              <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                <Check className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>

          <div className="flex items-start space-x-2 pt-2">
            <Checkbox 
              id="terms" 
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              disabled={isLoading}
              className="mt-1"
            />
            <Label htmlFor="terms" className="text-sm font-normal text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer leading-snug">
              I agree to the Terms of Service and Privacy Policy. I understand that monitoring devices without consent may be illegal in my jurisdiction.
            </Label>
          </div>

          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : "Create Account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-800/50 p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
