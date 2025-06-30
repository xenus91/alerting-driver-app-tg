import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons, deleteMessage } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  loading_points: Array<{
    point_id: string
    point_name: string
    point_num: number
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: string
    longitude?: string
  }>
  unloading_points: Array<{
    point_id: string
    point_name: string
    point_num: number
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: string
    longitude?: string
  }>
  is_restored?: boolean
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, isCorrection = false, deletedTrips = [] } = await request.json()

  try {
    console.log(`Resending combined message for messageId: ${messageId}, phone: ${phone}`)
    console.log(`Is correction: ${isCorrection}, deleted trips:`, deletedTrips)

    // 1. Получаем информацию о пользователе
    const userResult = await sql`
      SELECT telegram_id, first_name, full_name, name
      FROM users 
      WHERE phone = ${phone}
      LIMIT 1
    `

    if (userResult.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const user = userResult[0]
    const driverName = user.full_name || user.first_name || user.name || "Неизвестный водитель"

    // 2. Получаем trip_id из сообщения (учитываем только активные сообщения)
    const tripResult = await sql`
      SELECT trip_id FROM trip_messages 
      WHERE id = ${messageId} 
        AND status = 'sent'
    `

    if (tripResult.length === 0) {
      return NextResponse.json({ success: false, error: "Active trip message not found" }, { status: 404 })
    }

    const tripId = tripResult[0].trip_id

    // 3. Получаем ВСЕ активные сообщения для этого пользователя и рейса
    const messagesResult = await sql`
      SELECT DISTINCT
        tm.id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tm.status,
        tm.telegram_message_id,
        EXISTS (
          SELECT 1 FROM trip_messages prev
          WHERE prev.trip_identifier = tm.trip_identifier
            AND prev.status = 'deleted'
            AND prev.trip_id = tm.trip_id
        ) as is_restored
      FROM trip_messages tm
      WHERE tm.trip_id = ${tripId} 
        AND tm.phone = ${phone}
        AND tm.status = 'sent'
        AND tm.trip_identifier IS NOT NULL
        ${deletedTrips.length > 0 ? sql`AND NOT tm.trip_identifier = ANY(${deletedTrips})` : sql``}
      ORDER BY tm.trip_identifier
    `

    console.log(`Found ${messagesResult.length} active messages to resend`)

    if (messagesResult.length === 0) {
      return NextResponse.json({ success: false, error: "No active messages found to resend" }, { status: 404 })
    }

    // 4. Собираем данные о рейсах
    const trips: TripData[] = []

    for (const message of messagesResult) {
      console.log(`Processing trip: ${message.trip_identifier}${message.is_restored ? ' (restored)' : ''}`)

      // Получаем точки для каждого рейса (включая исторические)
      const pointsResult = await sql`
        SELECT DISTINCT
          tp.point_type,
          tp.point_num,
          p.point_id,
          p.point_name,
          p.door_open_1,
          p.door_open_2,
          p.door_open_3,
          p.latitude,
          p.longitude
        FROM trip_points tp
        JOIN points p ON tp.point_id = p.id
        WHERE tp.trip_id = ${tripId} 
          AND tp.trip_identifier = ${message.trip_identifier}
        ORDER BY tp.point_type DESC, tp.point_num
      `

      const loading_points = []
      const unloading_points = []

      for (const point of pointsResult) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          point_num: point.point_num,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
        }

        if (point.point_type === "P") {
          loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo)
        }
      }

      trips.push({
        trip_identifier: message.trip_identifier,
        vehicle_number: message.vehicle_number,
        planned_loading_time: message.planned_loading_time,
        driver_comment: message.driver_comment,
        loading_points,
        unloading_points,
        is_restored: message.is_restored
      })
    }

    console.log(`Prepared ${trips.length} trips for sending`)

    // 5. Удаляем предыдущие сообщения в Telegram
    const uniqueTelegramIds = new Set(
      messagesResult
        .filter(m => m.telegram_message_id)
        .map(m => m.telegram_message_id)
    )

    for (const telegramMessageId of uniqueTelegramIds) {
      try {
        await deleteMessage(user.telegram_id, telegramMessageId)
        console.log(`Deleted previous message ${telegramMessageId}`)
      } catch (error) {
        console.warn(`Failed to delete message ${telegramMessageId}:`, error)
      }
    }

    // 6. Отправляем объединенное сообщение
    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_id,
      trips,
      driverName,
      messageId, // Используем исходный messageId для кнопок
      isCorrection
    )

    // 7. Обновляем статусы всех сообщений
    const messageIdsToUpdate = messagesResult.map(m => m.id)

    await sql`
      UPDATE trip_messages 
      SET telegram_message_id = ${telegramResult.message_id},
          response_status = 'pending',
          response_comment = NULL,
          response_at = NULL,
          sent_at = CURRENT_TIMESTAMP
      WHERE id = ANY(${messageIdsToUpdate})
    `

    console.log(`Successfully sent correction to ${user.telegram_id}`)

    return NextResponse.json({
      success: true,
      message: "Correction sent successfully",
      telegram_message_id: telegramResult.message_id,
      trips_count: trips.length,
      updated_messages: messageIdsToUpdate.length,
    })
  } catch (error) {
    console.error("Error resending combined message:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
