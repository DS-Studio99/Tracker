import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Initialize Supabase Admin Client using Service Role Key
// Warning: This bypasses Row Level Security. Only use on the server API routes.
export const createAdminConfig = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase URL or Service Role Key in environment variables")
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Validates a device token sent by the mobile app
 * 
 * @param token The device token string
 * @returns Object with device_id and user_id, or null if invalid
 */
export async function validateDeviceToken(token: string): Promise<{ device_id: string; user_id: string } | null> {
  if (!token) return null

  try {
    const supabaseAdmin = createAdminConfig()

    const { data: device, error } = await supabaseAdmin
      .from("devices")
      .select("id, user_id")
      .eq("device_token", token)
      .single()

    if (error || !device) {
      console.error("Device token validation failed:", error?.message)
      return null
    }

    return {
      device_id: device.id,
      user_id: device.user_id
    }
  } catch (error) {
    console.error("Device token validation exception:", error)
    return null
  }
}

/**
 * Helper to standardise API error responses
 */
export const sendError = (message: string, status = 400) => {
  return NextResponse.json({ success: false, error: message }, { status })
}
