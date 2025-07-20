import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(req: NextRequest) {
  const sql = neon(process.env.DATABASE_URL!)

  try {
    const { trip_identifiers, exclude_phone } = await req.json()

    if (!trip_identifiers || !Array.isArray(trip_identifiers) || trip_identifiers.length === 0) {
      return NextResponse.json({ success: false, error: "Missing or invalid trip_identifiers" }, { status: 400 })
    }

    // Check for existing trips with these identifiers that are assigned to *other* drivers
    const conflictingTrips = await sql`
      SELECT
        t.trip_identifier,
        u.phone AS driver_phone,
        u.full_name AS driver_name,
        t.id AS trip_id
      FROM
        trips t
      JOIN
        users u ON t.driver_phone = u.phone
      WHERE
        t.trip_identifier IN (${sql.array(trip_identifiers)})
        AND t.status = 'assigned'
        ${exclude_phone ? sql`AND t.driver_phone != ${exclude_phone}` : sql``}
    `

    if (conflictingTrips.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "trip_already_assigned",
          trip_identifiers: conflictingTrips.map((t) => t.trip_identifier),
          conflict_data: conflictingTrips,
        },
        { status: 409 },
      ) // 409 Conflict
    }

    return NextResponse.json({ success: true, message: "No conflicts found" })
  } catch (error) {
    console.error("Error checking trip conflicts:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
