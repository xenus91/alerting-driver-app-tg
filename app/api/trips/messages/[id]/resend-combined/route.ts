import { NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: Request) {
  try {
    const { phone, driver_phone, messageIds, isCorrection, deletedTrips } = await request.json()

    if (!driver_phone || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid request data" }, { status: 400 })
    }

    const client = await sql.connect()

    try {
      await client.query("BEGIN")

      // Fetch all relevant trip data for the driver, ordered by planned_loading_time
      const tripsResult = await client.query(
        `SELECT
           t.id AS trip_id,
           t.trip_identifier,
           t.vehicle_number,
           t.planned_loading_time,
           t.driver_comment,
           tm.message_id,
           tp.point_type,
           tp.point_num,
           tp.point_id,
           p.point_name,
           p.latitude,
           p.longitude,
           p.reception_windows
         FROM trips t
         JOIN trip_messages tm ON t.id = tm.trip_id
         JOIN trip_points tp ON t.id = tp.trip_id
         JOIN points p ON tp.point_id = p.point_id
         WHERE t.driver_phone = $1
         ORDER BY t.planned_loading_time, tp.point_num`, // Sort by trip loading time, then point number
        [driver_phone],
      )

      const tripsData: any[] = []
      const groupedTrips: { [key: string]: any } = {}

      for (const row of tripsResult.rows) {
        if (!groupedTrips[row.trip_id]) {
          groupedTrips[row.trip_id] = {
            trip_id: row.trip_id,
            trip_identifier: row.trip_identifier,
            vehicle_number: row.vehicle_number,
            planned_loading_time: row.planned_loading_time,
            driver_comment: row.driver_comment,
            message_id: row.message_id,
            points: [], // All points in one array
          }
        }
        groupedTrips[row.trip_id].points.push({
          point_type: row.point_type,
          point_num: row.point_num,
          point_id: row.point_id,
          point_name: row.point_name,
          latitude: row.latitude,
          longitude: row.longitude,
          reception_windows: row.reception_windows,
        })
      }

      // Convert grouped object to array and sort points within each trip
      for (const tripId in groupedTrips) {
        groupedTrips[tripId].points.sort((a: any, b: any) => a.point_num - b.point_num)
        tripsData.push(groupedTrips[tripId])
      }

      // Fetch user's Telegram ID
      const userResult = await client.query(`SELECT telegram_id FROM users WHERE phone = $1`, [driver_phone])
      const telegramId = userResult.rows[0]?.telegram_id

      if (!telegramId) {
        await client.query("ROLLBACK")
        return NextResponse.json({ success: false, error: "Telegram ID not found for driver" }, { status: 404 })
      }

      // Send the combined message
      const sendResult = await sendMultipleTripMessageWithButtons(
        telegramId,
        tripsData,
        isCorrection, // Pass isCorrection
        true, // isResend is true for this route
        deletedTrips,
      )

      if (sendResult.success) {
        // Update message_id in trip_messages if it was a new message or changed
        for (const trip of tripsData) {
          if (trip.message_id !== sendResult.messageId) {
            await client.query(`UPDATE trip_messages SET message_id = $1, updated_at = NOW() WHERE trip_id = $2`, [
              sendResult.messageId,
              trip.trip_id,
            ])
          }
        }
        await client.query("COMMIT")
        return NextResponse.json({ success: true, messageId: sendResult.messageId })
      } else {
        await client.query("ROLLBACK")
        return NextResponse.json({ success: false, error: sendResult.error }, { status: 500 })
      }
    } catch (dbError: any) {
      await client.query("ROLLBACK")
      console.error("Database transaction error:", dbError)
      return NextResponse.json(
        { success: false, error: "Failed to resend combined message", details: dbError.message },
        { status: 500 },
      )
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error("Error in resend-combined route:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error.message },
      { status: 500 },
    )
  }
}
