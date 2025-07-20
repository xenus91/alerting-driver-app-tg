import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { sendTripMessage } from "@/lib/telegram"
import { normalizePhoneNumber } from "@/lib/utils"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = params.id
  const { phone, driver_phone, messageIds, isCorrection, deletedTrips } = await request.json()

  if (!messageId || !phone || !driver_phone || !messageIds) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
  }

  const normalizedPhone = normalizePhoneNumber(phone)
  const normalizedDriverPhone = normalizePhoneNumber(driver_phone)

  try {
    // Fetch trip details for the given messageId
    const { rows: tripMessages } = await sql`
      SELECT
        tm.trip_id,
        tm.message_id,
        tm.telegram_message_id,
        tm.driver_phone,
        t.trip_identifier,
        t.vehicle_number,
        t.planned_loading_time,
        t.driver_comment,
        tp.point_id,
        tp.point_type,
        tp.point_num,
        p.point_name,
        p.latitude,
        p.longitude
      FROM trip_messages tm
      JOIN trips t ON tm.trip_id = t.id
      LEFT JOIN trip_points tp ON t.id = tp.trip_id
      LEFT JOIN points p ON tp.point_id = p.point_id
      WHERE tm.message_id = ${Number.parseInt(messageId)}
      ORDER BY tp.point_num ASC;
    `

    if (tripMessages.length === 0) {
      return NextResponse.json({ success: false, error: "Trip message not found" }, { status: 404 })
    }

    // Group points by trip_identifier
    const groupedTrips = tripMessages.reduce((acc: any, row: any) => {
      const tripIdentifier = row.trip_identifier
      if (!acc[tripIdentifier]) {
        acc[tripIdentifier] = {
          trip_id: row.trip_id,
          message_id: row.message_id,
          telegram_message_id: row.telegram_message_id,
          driver_phone: row.driver_phone,
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment,
          points: [],
        }
      }
      if (row.point_id) {
        acc[tripIdentifier].points.push({
          point_id: row.point_id,
          point_type: row.point_type,
          point_num: row.point_num,
          point_name: row.point_name,
          latitude: row.latitude,
          longitude: row.longitude,
        })
      }
      return acc
    }, {})

    const tripsToSend = Object.values(groupedTrips)

    // Fetch user's Telegram ID
    const { rows: users } = await sql`
      SELECT telegram_id FROM users WHERE phone = ${normalizedPhone};
    `

    if (users.length === 0 || !users[0].telegram_id) {
      return NextResponse.json({ success: false, error: "User not found or Telegram ID missing" }, { status: 404 })
    }

    const telegramId = users[0].telegram_id

    // Send message to Telegram
    const sendResult = await sendTripMessage(
      telegramId,
      tripsToSend as any, // Cast to any for now, refine type later
      isCorrection,
      deletedTrips,
      messageIds[0], // Use the first messageId as the original message_id for editing
    )

    if (sendResult.success) {
      // Update message_sent_at and status in trip_messages
      await sql`
        UPDATE trip_messages
        SET
          message_sent_at = NOW(),
          status = 'sent',
          telegram_message_id = ${sendResult.telegramMessageId}
        WHERE message_id = ANY(${messageIds}::int[]);
      `

      // Update trip status to 'sent'
      await sql`
        UPDATE trips
        SET status = 'sent'
        WHERE id = ANY(${messageIds}::int[]);
      `

      return NextResponse.json({ success: true, telegramMessageId: sendResult.telegramMessageId })
    } else {
      // Update message status to 'failed'
      await sql`
        UPDATE trip_messages
        SET status = 'failed'
        WHERE message_id = ANY(${messageIds}::int[]);
      `
      return NextResponse.json({ success: false, error: sendResult.error }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Error resending combined message:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resend combined message" },
      { status: 500 },
    )
  }
}
