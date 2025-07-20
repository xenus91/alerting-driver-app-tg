import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  const { trip_identifiers, exclude_phone } = await request.json()

  if (!trip_identifiers || !Array.isArray(trip_identifiers) || trip_identifiers.length === 0) {
    return NextResponse.json({ success: false, error: "Missing trip_identifiers" }, { status: 400 })
  }

  try {
    console.log(`Checking conflicts for identifiers: ${trip_identifiers.join(", ")}`)
    console.log(`Excluding phone: ${exclude_phone || "none"}`)

    let conflictingTrips
    if (exclude_phone) {
      conflictingTrips = await sql`
        SELECT 
          tm.trip_identifier,
          tm.trip_id, 
          tm.phone,
          u.first_name,
          u.full_name
        FROM trip_messages tm
        LEFT JOIN users u ON u.phone = tm.phone
        WHERE tm.trip_identifier = ANY(${trip_identifiers}::text[])
          AND tm.phone <> ${exclude_phone}
          AND (tm.response_status IS NULL OR tm.response_status NOT IN ('declined', 'rejected', 'error'))
      `
    } else {
      conflictingTrips = await sql`
        SELECT 
          tm.trip_identifier,
          tm.trip_id, 
          tm.phone,
          u.first_name,
          u.full_name
        FROM trip_messages tm
        LEFT JOIN users u ON u.phone = tm.phone
        WHERE tm.trip_identifier = ANY(${trip_identifiers}::text[])
          AND (tm.response_status IS NULL OR tm.response_status NOT IN ('declined', 'rejected', 'error'))
      `
    }

    if (conflictingTrips.length > 0) {
      const conflictData = conflictingTrips.map((t) => ({
        trip_identifier: t.trip_identifier,
        driver_phone: t.phone,
        driver_name: t.full_name || t.first_name || t.phone,
        trip_id: t.trip_id,
      }))

      console.log(`Conflict found for trips: ${conflictData.map((c) => c.trip_identifier).join(", ")}`)

      return NextResponse.json(
        {
          success: false,
          error: "trip_already_assigned",
          trip_identifiers: conflictData.map((c) => c.trip_identifier),
          conflict_data: conflictData,
        },
        { status: 409 },
      )
    } else {
      console.log("No trip conflicts found")
      return NextResponse.json({ success: true, message: "No conflicts found" }, { status: 200 })
    }
  } catch (error) {
    console.error("Error checking conflicts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check conflicts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
