import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)

  try {
    const { phone, driver_phone, messageIds, isCorrection = false, deletedTrips = [] } = await request.json()

    console.log("=== RESEND COMBINED REQUEST ===")
    console.log("Message ID:", messageId)
    console.log("Phone:", phone)
    console.log("Driver Phone:", driver_phone)
    console.log("Message IDs:", messageIds)
    console.log("Is Correction:", isCorrection)
    console.log("Deleted Trips:", deletedTrips)

    if (!messageIds || messageIds.length === 0) {
      return NextResponse.json({ success: false, error: "No message IDs provided" }, { status: 400 })
    }

    // Получаем информацию о пользователе
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
    const driverName = user.first_name || user.full_name || user.name || "Неизвестный водитель"

    // Получаем старый telegram_message_id для удаления
    const previousMessageResult = await sql`
      SELECT telegram_message_id
      FROM trip_messages
      WHERE id = ANY(${messageIds}::int[])
        AND telegram_message_id IS NOT NULL
      LIMIT 1
    `

    let previousTelegramMessageId = null
    if (previousMessageResult.length > 0) {
      previousTelegramMessageId = previousMessageResult[0].telegram_message_id
    }

    // Получаем данные о рейсах для отправки
    const messagesResult = await sql`
      SELECT DISTINCT
        tm.id,
        tm.trip_id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tm.phone,
        tm.telegram_id
      FROM trip_messages tm
      WHERE tm.id = ANY(${messageIds}::int[])
        AND tm.phone = ${phone}
      ORDER BY tm.planned_loading_time
    `

    if (messagesResult.length === 0) {
      return NextResponse.json({ success: false, error: "Messages not found" }, { status: 404 })
    }

    console.log(`Found ${messagesResult.length} messages to resend`)

    const trips = []

    // Для каждого сообщения получаем точки
    for (const message of messagesResult) {
      console.log(`Processing trip: ${message.trip_identifier}`)

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
          p.longitude,
          p.adress
        FROM trip_points tp
        JOIN points p ON tp.point_id = p.id
        WHERE tp.trip_id = ${message.trip_id}
          AND tp.trip_identifier = ${message.trip_identifier}
          AND tp.driver_phone = ${driver_phone}
        ORDER BY tp.point_num
      `

      console.log(`Found ${pointsResult.length} points for trip ${message.trip_identifier}`)

      const loading_points = []
      const unloading_points = []
      const all_points = [] // Временный массив для сортировки

      // Собираем все точки
      for (const point of pointsResult) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          adress: point.adress,
          point_type: point.point_type,
          point_num: point.point_num,
        }

        all_points.push(pointInfo)
      }

      // Сортируем по point_num
      all_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Разделяем по типам, сохраняя порядок
      for (const point of all_points) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          adress: point.adress,
          point_num: point.point_num,
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
        driver_comment: message.driver_comment || "",
        loading_points,
        unloading_points,
      })
    }

    console.log(`Prepared ${trips.length} trips for resending`)

    // Отправляем сообщение
    const { message_id, messageText } = await sendMultipleTripMessageWithButtons(
      Number(user.telegram_id),
      trips,
      driverName,
      messageIds[0],
      isCorrection, // Передаем isCorrection из запроса
      true, // isResend = true
      previousTelegramMessageId,
    )

    // Обновляем статусы всех сообщений
    await sql`
      UPDATE trip_messages 
      SET telegram_message_id = ${message_id},
          status = 'sent',
          sent_at = CURRENT_TIMESTAMP,
          message = ${messageText}
      WHERE id = ANY(${messageIds}::int[])
        AND phone = ${phone}
    `

    console.log(`Successfully resent to ${user.telegram_id}, updated ${messageIds.length} messages`)

    return NextResponse.json({
      success: true,
      message: "Messages resent successfully",
      telegram_message_id: message_id,
      trips_count: trips.length,
      updated_messages: messageIds.length,
    })
  } catch (error) {
    console.error("Error resending messages:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend messages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
