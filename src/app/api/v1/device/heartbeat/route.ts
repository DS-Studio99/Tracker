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
      ram_total, ram_used, screen_status, is_online 
    } = body

    // Some basic validation (but don't fail strictly if some fields are missing, as long as heartbeat is logged)
    if (typeof battery_level !== 'number') {
      return sendError("battery_level must be a number", 400)
    }

    const supabaseAdmin = createAdminConfig()

    const { error } = await supabaseAdmin
      .from("devices")
      .update({
        battery_level,
        is_charging: is_charging ?? false,
        storage_total: storage_total ?? 0,
        storage_used: storage_used ?? 0,
        ram_total: ram_total ?? 0,
        ram_used: ram_used ?? 0,
        screen_status: screen_status || "unknown",
        status: is_online !== false ? "online" : "offline",
        last_seen: new Date().toISOString()
      })
      .eq("id", validation.device_id)

    if (error) {
      console.error("Failed to update device heartbeat:", error.message)
      return sendError("Database error during heartbeat update", 500)
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    console.error("Heartbeat endpoint error:", error)
    return sendError("Internal server error", 500)
  }
}
