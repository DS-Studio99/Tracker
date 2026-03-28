import { NextResponse } from "next/server"
import { createAdminConfig, validateDeviceToken, sendError } from "@/lib/utils/api-helpers"

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization")
  return authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null
}

export async function POST(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) return sendError("Missing or invalid authorization header", 401)
    
    const validation = await validateDeviceToken(token)
    if (!validation) return sendError("Invalid or expired device token", 401)

    const body = await req.json()
    const { command_id, status, result, result_media_url } = body

    if (!command_id || !status) {
      return sendError("Missing required fields: command_id and status", 400)
    }

    if (!["executed", "failed"].includes(status)) {
      return sendError("Invalid status value. Allowed: 'executed', 'failed'", 400)
    }

    const supabaseAdmin = createAdminConfig()

    // 1. Verify that the command actually belongs to this device to prevent cross-device manipulation
    const { data: commandToVerify, error: verifyError } = await supabaseAdmin
      .from("remote_commands")
      .select("device_id")
      .eq("id", command_id)
      .single()

    if (verifyError || !commandToVerify) {
       console.error("Remote command validation fetch error:", verifyError?.message)
       return sendError("Command not found or accessible", 404)
    }

    if (commandToVerify.device_id !== validation.device_id) {
       return sendError("Command does not belong to authorized device", 403)
    }

    // 2. Perform the update
    const { error: updateError } = await supabaseAdmin
      .from("remote_commands")
      .update({
        status: status,
        result: result ?? null,
        result_media_url: result_media_url ?? null,
        executed_at: new Date().toISOString()
      })
      .eq("id", command_id)

    if (updateError) {
      console.error("Command status update error:", updateError.message)
      return sendError("Database update failure", 500)
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    console.error("Commands Result POST endpoint error:", error)
    return sendError("Internal server error", 500)
  }
}
