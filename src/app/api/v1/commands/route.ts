import { NextResponse } from "next/server"
import { createAdminConfig, validateDeviceToken, sendError } from "@/lib/utils/api-helpers"

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization")
  return authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null
}

export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) return sendError("Missing or invalid authorization header", 401)
    
    const validation = await validateDeviceToken(token)
    if (!validation) return sendError("Invalid or expired device token", 401)

    const supabaseAdmin = createAdminConfig()
    const nowISO = new Date().toISOString()

    // 1. Fetch pending tasks that haven't expired
    const { data: commands, error: fetchError } = await supabaseAdmin
      .from("remote_commands")
      .select("*")
      .eq("device_id", validation.device_id)
      .eq("status", "pending")
      .or(`expires_at.is.null,expires_at.gt.${nowISO}`)

    if (fetchError) {
      console.error("Fetch pending commands error:", fetchError.message)
      return sendError("Database fetch failure", 500)
    }

    if (!commands || commands.length === 0) {
      return NextResponse.json({ commands: [] }, { status: 200 })
    }

    // 2. Mark fetched commands as 'sent'
    const commandIds = commands.map(c => c.id)
    const { error: updateError } = await supabaseAdmin
      .from("remote_commands")
      .update({ status: "sent" })
      .in("id", commandIds)

    if (updateError) {
      console.error("Update command status to 'sent' error:", updateError.message)
      // Even if update failed we should probably still return commands to ensure they execute,
      // though typically you want exactly-once dispatch.
    }

    // 3. Return the payload for the Android app
    return NextResponse.json({ commands }, { status: 200 })

  } catch (error: any) {
    console.error("Commands GET endpoint error:", error)
    return sendError("Internal server error", 500)
  }
}
