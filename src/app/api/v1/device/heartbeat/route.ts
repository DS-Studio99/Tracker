import { NextResponse } from "next/server"
import { createAdminConfig, validateDeviceToken, sendError } from "@/lib/utils/api-helpers"

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError("Missing or invalid authorization header", 401)
    }

    const token = authHeader.split(" ")[1]
    const validation = await validateDeviceToken(token)

    if (!validation) {
      return sendError("Invalid or expired device token", 401)
    }

    const body = await req.json()
    const { 
      battery_level, is_charging, storage_total, storage_used, 
      ram_total, ram_used, screen_status, network_type, current_app
    } = body

    // Battery level validation (relaxed — don't reject if 0)
    if (battery_level === undefined || battery_level === null) {
      return sendError("battery_level is required", 400)
    }

    const supabaseAdmin = createAdminConfig()

    // ✅ FIXED: is_online = true সেট করো, last_seen update করো, সব device info save করো
    const { error } = await supabaseAdmin
      .from("devices")
      .update({
        battery_level: typeof battery_level === 'number' ? battery_level : 0,
        is_charging: is_charging ?? false,
        storage_total: storage_total ?? null,
        storage_used: storage_used ?? null,
        ram_total: ram_total ?? null,
        ram_used: ram_used ?? null,
        screen_status: screen_status || "unknown",
        network_type: network_type || null,
        current_app: current_app || null,
        is_online: true,          // ✅ Always mark online when heartbeat received
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", validation.device_id)

    if (error) {
      console.error("Failed to update device heartbeat:", error.message)
      return sendError("Database error during heartbeat update", 500)
    }

    // ✅ Fetch device settings to check if any settings updates needed
    const { data: settings } = await supabaseAdmin
      .from("device_settings")
      .select("*")
      .eq("device_id", validation.device_id)
      .single()

    // Return settings so device can apply them
    return NextResponse.json({ 
      success: true,
      settings_updated: !!settings,
      settings: settings || null
    }, { status: 200 })

  } catch (error: any) {
    console.error("Heartbeat endpoint error:", error)
    return sendError("Internal server error", 500)
  }
}
