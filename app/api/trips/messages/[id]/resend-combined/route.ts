import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons, deleteMessage } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { phone, messageIds, isCorrection = false, deletedTrips = [] } = await request.json()
    const tripId = Number.parseInt(params.id)

    console.log("=== RESEND COMBINED MESSAGE ===")
    console.log("Trip ID:", tripId)
    console.log("Phone:", phone)
    console.log("Message IDs:", messageIds)
    console.log("Is correction:", isCorrection)
    console.log("Deleted trips:", deletedTrips)

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone is required" }, { status: 400 })
    }

    // Находим все активные сообщения для этого телефона и trip_id
    const messages = await sql`
      SELECT DISTINCT tm.*, u.first_name, u.telegram_id
      FROM trip_messages tm
      JOIN users u ON u.phone = tm.phone
      WHERE tm.trip_id = ${tripId}
      AND tm.phone = ${phone}
      AND tm.status = 'sent'
      ORDER BY tm.trip_identifier
    `

    if (messages.length === 0) {
      return NextResponse.json({ success: false, error: "No active trip messages found" }, { status: 404 })
    }

    const firstMessage = messages[0]
    const telegramId = firstMessage.telegram_id
    const firstName = firstMessage.first_name

    console.log(`Found ${messages.length} active messages for phone ${phone}`)

    // Получаем точки для всех рейсов
    const points = await sql`
      SELECT * FROM trip_points 
      WHERE trip_id = ${tripId}
      AND trip_identifier IN (${messages.map((m) => m.trip_identifier).join(",")})
      ORDER BY trip_identifier, point_type, point_num
    `

    // Группируем данные по рейсам
    const tripsData = messages.map((message) => {
      const tripPoints = points.filter((p) => p.trip_identifier === message.trip_identifier)

      const loadingPoints = tripPoints
        .filter((p) => p.point_type === "P")
        .map((p) => ({
          point_id: p.point_id,
          point_name: p.point_name,
          door_open_1: p.door_open_1,
          door_open_2: p.door_open_2,
          door_open_3: p.door_open_3,
          latitude: p.latitude,
          longitude: p.longitude,
        }))

      const unloadingPoints = tripPoints
        .filter((p) => p.point_type === "D")
        .map((p) => ({
          point_id: p.point_id,
          point_name: p.point_name,
          door_open_1: p.door_open_1,
          door_open_2: p.door_open_2,
          door_open_3: p.door_open_3,
          latitude: p.latitude,
          longitude: p.longitude,
        }))

      return {
        trip_identifier: message.trip_identifier,
        vehicle_number: message.vehicle_number,
        planned_loading_time: message.planned_loading_time,
        driver_comment: message.driver_comment || "",
        loading_points: loadingPoints,
        unloading_points: unloadingPoints,
      }
    })

    console.log(`Prepared ${tripsData.length} trips for sending`)

    // Удаляем старые сообщения если есть telegram_message_id
    if (isCorrection) {
      for (const message of messages) {
        if (message.telegram_message_id) {
          console.log(`Deleting old Telegram message: ${message.telegram_message_id}`)
          await deleteMessage(telegramId, message.telegram_message_id)
        }
      }
    }

    // Отправляем новое сообщение
    const result = await sendMultipleTripMessageWithButtons(telegramId, tripsData, firstName, tripId, isCorrection)

    if (!result || !result.message_id) {
      throw new Error("Failed to send Telegram message")
    }

    console.log(`Successfully sent message with ID: ${result.message_id}`)

    // Обновляем telegram_message_id для всех сообщений
    for (const message of messages) {
      await sql`
        UPDATE trip_messages 
        SET telegram_message_id = ${result.message_id},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${message.id}
      `
    }

    return NextResponse.json({
      success: true,
      message: "Combined message sent successfully",
      telegram_message_id: result.message_id,
      trips_count: tripsData.length,
    })
  } catch (error) {
    console.error("Error resending combined message:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
