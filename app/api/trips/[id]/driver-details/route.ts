import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get("phone")

  if (!phone) {
    return NextResponse.json({ success: false, error: "Phone parameter is required" }, { status: 400 })
  }

  try {
    console.log(`Getting driver details for trip ${tripId}, phone ${phone}`)

    // Получаем все рейсы водителя с точками
    const result = await sql`
      SELECT DISTINCT
        tm.phone,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tp.point_type,
        tp.point_num,
        p.point_id,
        p.point_name,
        tm.id as message_id
      FROM trip_messages tm
      LEFT JOIN trip_points tp ON tm.trip_id = tp.trip_id AND tm.trip_identifier = tp.trip_identifier AND tp.driver_phone = tm.phone
      LEFT JOIN points p ON tp.point_id = p.id
      WHERE tm.trip_id = ${tripId} AND tm.phone = ${phone}
      ORDER BY tm.trip_identifier, tp.point_type DESC, tp.point_num
    `

    console.log(`Found ${result.length} records for driver ${phone}`)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Error getting driver details:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get driver details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
