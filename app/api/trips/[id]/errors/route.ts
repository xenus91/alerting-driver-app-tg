import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

const sql = neon(process.env.DATABASE_URL!)

async function getCurrentUser() {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get("session_token")

    if (!sessionCookie) {
      return null
    }

    const result = await sql`
      SELECT u.id, u.telegram_id, u.phone, u.name, u.role, u.carpark, u.verified
      FROM users u
      JOIN user_sessions us ON u.id = us.user_id
      WHERE us.session_token = ${sessionCookie.value}
      AND us.expires_at > NOW()
      LIMIT 1
    `

    return result[0] || null
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const tripId = Number.parseInt(params.id)
    if (isNaN(tripId)) {
      return NextResponse.json({ success: false, error: "Invalid trip ID" }, { status: 400 })
    }

    let tripQuery
    if (currentUser.role === "admin") {
      tripQuery = await sql`
        SELECT id, carpark FROM trips WHERE id = ${tripId}
      `
    } else {
      tripQuery = await sql`
        SELECT id, carpark FROM trips 
        WHERE id = ${tripId} AND carpark = ${currentUser.carpark}
      `
    }

    if (tripQuery.length === 0) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    const errors = await sql`
      SELECT 
        tm.id,
        tm.phone,
        tm.error_message,
        tm.created_at,
        u.full_name as user_name
      FROM trip_messages tm
      LEFT JOIN users u ON tm.phone = u.phone
      WHERE tm.trip_id = ${tripId}
      AND tm.error_message IS NOT NULL
      AND tm.error_message != ''
      ORDER BY tm.created_at DESC
    `

    console.log(`Found ${errors.length} errors for trip ${tripId}`)

    return NextResponse.json({
      success: true,
      errors: errors,
    })
  } catch (error) {
    console.error("Error fetching trip errors:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
