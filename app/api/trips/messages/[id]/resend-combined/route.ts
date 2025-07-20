import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"
import { getSession } from "@/lib/database"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const messageId = params.id // This is the ID of one of the messages in the batch
  const sql = neon(process.env.DATABASE_URL!)

  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { phone, driver_phone, messageIds, isCorrection, deletedTrips } = await req.json()

    if (!driver_phone || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ success: false, error: "Missing driver_phone or messageIds" }, { status: 400 })
    }

    // Fetch all trip messages and their points for the given messageIds and driver_phone
    const tripData = await sql`
      SELECT
        tm.id AS trip_message_id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tm.driver_phone,
        tp.point_type,
        tp.point_num,
        p.point_id,
        p.point_name,
        p.latitude,
        p.longitude,
        p.address,
        p.reception_windows
      FROM trip_messages tm
      JOIN trip_points tp ON tm.id = tp.trip_message_id
      JOIN points p ON tp.point_id = p.point_id
      WHERE tm.id IN (${sql(messageIds)})
      AND tm.driver_phone = ${driver_phone}
      ORDER BY tm.planned_loading_time, tp.point_num
    `

    if (tripData.length === 0) {
      return NextResponse.json(
        { success: false, error: "No trip data found for the given message IDs" },
        { status: 404 },
      )
    }

    // Group points by trip_identifier
    const groupedTrips = tripData.reduce((acc: any, row: any) => {
      const tripIdentifier = row.trip_identifier
      if (!acc[tripIdentifier]) {
        acc[tripIdentifier] = {
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment,
          driver_phone: row.driver_phone,
          points: [],
        }
      }
      acc[tripIdentifier].points.push({
        point_type: row.point_type,
        point_num: row.point_num,
        point_id: row.point_id,
        point_name: row.point_name,
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        reception_windows: row.reception_windows,
      })
      return acc
    }, {})

    const tripsToSend = Object.values(groupedTrips).map((trip: any) => {
      // Sort points by point_num for each trip
      trip.points.sort((a: any, b: any) => a.point_num - b.point_num)
      return trip
    })

    // Send the combined message
    const telegramResponse = await sendMultipleTripMessageWithButtons(
      driver_phone,
      tripsToSend,
      isCorrection, // Pass isCorrection flag
      true, // isResend
      deletedTrips,
    )

    if (telegramResponse.success) {
      // Update status of sent messages to 'sent' or 'pending' if it was 'cancelled'
      await sql`
        UPDATE trip_messages
        SET status = 'pending'
        WHERE id IN (${sql(messageIds)})
      `
      return NextResponse.json({ success: true, results: telegramResponse.results })
    } else {
      return NextResponse.json({ success: false, error: telegramResponse.error }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Error in resend-combined route:", error)
    return NextResponse.json(
      { success: false, error: "Failed to resend combined message", details: error.message },
      { status: 500 },
    )
  }
}
