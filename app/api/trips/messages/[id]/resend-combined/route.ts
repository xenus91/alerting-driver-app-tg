import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, driver_phone, messageIds, isCorrection = false, deletedTrips = [] } = await request.json()

  try {
    console.log(`=== RESEND COMBINED ===`)
    console.log(`Message ID: ${messageId}`)
    console.log(`Phone: ${phone}`)
    console.log(`Driver Phone: ${driver_phone}`)
    console.log(`Message IDs: ${JSON.stringify(messageIds)}`)
    console.log(`Is Correction: ${isCorrection}`)
    console.log(`Deleted Trips: ${JSON.stringify(deletedTrips)}`)

    // Получаем trip_id из первого сообщения
    const tripResult = await sql`
      SELECT trip_id FROM trip_messages WHERE id = ${messageId} LIMIT 1
    `

    if (tripResult.length === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 })
    }

    const tripId = tripResult[0].trip_id

    // Получаем данные о рейсах для отправки сообщения
    const messages = await sql`
      SELECT 
        tm.id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tm.telegram_id,
        u.first_name,
        u.full_name,
        tm.telegram_message_id,
        p.point_id,
        p.point_name,
        p.adress,
        tp.point_type,
        tp.point_num,
        p.latitude,
        p.longitude,
        p.door_open_1,
        p.door_open_2,
        p.door_open_3
      FROM trip_messages tm
      LEFT JOIN (
        SELECT * FROM trip_points 
        WHERE driver_phone = ${driver_phone}  
      ) tp ON tm.trip_id = tp.trip_id AND tm.trip_identifier = tp.trip_identifier
      LEFT JOIN points p ON tp.point_id = p.id
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = ${tripId}
        AND tm.phone = ${phone}
      ORDER BY tm.planned_loading_time, tp.point_num
    `

    if (messages.length === 0) {
      return NextResponse.json({ success: false, error: "Messages not found" }, { status: 404 })
    }

    // Группируем точки по trip_identifier
    const tripsMap = new Map<string, any>()
    for (const row of messages) {
      if (!tripsMap.has(row.trip_identifier)) {
        tripsMap.set(row.trip_identifier, {
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment || "",
          loading_points: [],
          unloading_points: [],
          all_points: [], // Добавляем массив для всех точек в порядке point_num
        })
      }

      if (row.point_id) {
        const point = {
          point_id: row.point_id,
          point_name: row.point_name,
          adress: row.adress,
          door_open_1: row.door_open_1,
          door_open_2: row.door_open_2,
          door_open_3: row.door_open_3,
          latitude: row.latitude,
          longitude: row.longitude,
          point_type: row.point_type,
          point_num: row.point_num,
        }

        const trip = tripsMap.get(row.trip_identifier)!
        trip.all_points.push(point)
      }
    }

    // Сортируем точки по point_num и разделяем по типам, сохраняя порядок
    for (const [tripIdentifier, tripData] of tripsMap) {
      // Сортируем все точки по point_num
      tripData.all_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Разделяем на loading и unloading, сохраняя порядок
      for (const point of tripData.all_points) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          adress: point.adress,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          point_num: point.point_num,
        }

        if (point.point_type === "P") {
          tripData.loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          tripData.unloading_points.push(pointInfo)
        }
      }

      // Удаляем временный массив
      delete tripData.all_points
    }

    const trips = Array.from(tripsMap.values())
    trips.sort((a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime())

    const telegramId = messages[0].telegram_id
    const driverName = messages[0].first_name || messages[0].full_name || "Водитель"
    const previousTelegramMessageId = messages[0].telegram_message_id
    const allMessageIds = messages.map((m) => m.id)

    console.log(`Sending to telegram_id: ${telegramId}, trips: ${trips.length}, isCorrection: ${isCorrection}`)

    // Отправляем сообщение
    const { message_id, messageText } = await sendMultipleTripMessageWithButtons(
      Number(telegramId),
      trips,
      driverName,
      messageId,
      isCorrection, // Передаем isCorrection из запроса
      !isCorrection, // isResend = true если не корректировка
      previousTelegramMessageId,
    )

    // Обновляем все сообщения водителя с новым telegram_message_id и текстом
    await sql`
      UPDATE trip_messages
      SET 
        telegram_message_id = ${message_id},
        status = 'sent',
        sent_at = NOW(),
        message = ${messageText}
      WHERE id = ANY(${allMessageIds})
      AND phone = ${phone}
    `

    console.log(`Successfully sent message ${message_id} to ${telegramId}`)

    return NextResponse.json({
      success: true,
      message: "Message resent successfully",
      telegram_message_id: message_id,
      trips_count: trips.length,
    })
  } catch (error) {
    console.error("Error resending combined message:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
