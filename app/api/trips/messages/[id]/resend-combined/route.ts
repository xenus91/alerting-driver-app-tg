import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

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
}

async function sendTelegramMessage(
  telegramId: number,
  message: string,
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Подтвердить", callback_data: "confirm_trip" },
              { text: "❌ Отклонить", callback_data: "reject_trip" },
            ],
          ],
        },
      }),
    })

    const data = await response.json()

    if (data.ok) {
      return { success: true, messageId: data.result.message_id }
    } else {
      console.error("Telegram API error:", data)
      return { success: false, error: data.description || "Unknown Telegram API error" }
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

function formatTripMessage(driverName: string, trips: TripData[], isCorrection = false, tripId: number): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://v0-tg-bot-allerting.vercel.app"
  const tripUrl = `${baseUrl}/trips/${tripId}`

  let message = isCorrection
    ? `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n👤 Водитель: <b>${driverName}</b>\n\n`
    : `📋 <b>НОВЫЕ РЕЙСЫ</b>\n\n👤 Водитель: <b>${driverName}</b>\n\n`

  trips.forEach((trip, index) => {
    message += `🚛 <b>Рейс ${trip.trip_identifier}</b>\n`
    message += `🚗 Транспорт: <b>${trip.vehicle_number}</b>\n`

    // Форматируем время
    if (trip.planned_loading_time) {
      try {
        const date = new Date(trip.planned_loading_time)
        const formattedDate = date.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        const formattedTime = date.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })
        message += `⏰ Время погрузки: <b>${formattedDate} ${formattedTime}</b>\n`
      } catch {
        message += `⏰ Время погрузки: <b>${trip.planned_loading_time}</b>\n`
      }
    }

    if (trip.driver_comment) {
      message += `💬 Комментарий: <i>${trip.driver_comment}</i>\n`
    }

    // Точки погрузки
    if (trip.loading_points.length > 0) {
      message += `\n📍 <b>Точки погрузки:</b>\n`
      trip.loading_points.forEach((point) => {
        message += `   ${point.point_num}. <b>${point.point_id}</b> - ${point.point_name}\n`
        if (point.door_open_1 || point.door_open_2 || point.door_open_3) {
          const doors = [point.door_open_1, point.door_open_2, point.door_open_3].filter(Boolean)
          message += `      🚪 Ворота: ${doors.join(", ")}\n`
        }
      })
    }

    // Точки разгрузки
    if (trip.unloading_points.length > 0) {
      message += `\n📍 <b>Точки разгрузки:</b>\n`
      trip.unloading_points.forEach((point) => {
        message += `   ${point.point_num}. <b>${point.point_id}</b> - ${point.point_name}\n`
        if (point.door_open_1 || point.door_open_2 || point.door_open_3) {
          const doors = [point.door_open_1, point.door_open_2, point.door_open_3].filter(Boolean)
          message += `      🚪 Ворота: ${doors.join(", ")}\n`
        }
      })
    }

    if (index < trips.length - 1) {
      message += "\n" + "─".repeat(30) + "\n\n"
    }
  })



  if (isCorrection) {
    message += "\n\n⚠️ <b>Внимание:</b> Это корректировка. Пожалуйста, подтвердите или отклоните обновленные рейсы."
  } else {
    message += "\n\n✅ Пожалуйста, подтвердите или отклоните рейсы."
  }

  return message
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, messageIds, isCorrection = false, deletedTrips = [] } = await request.json()

  try {
    console.log(`Resending combined message for messageId: ${messageId}, phone: ${phone}`)
    console.log(`Is correction: ${isCorrection}, deleted trips:`, deletedTrips)

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
    const driverName = user.full_name || user.first_name || user.name || "Неизвестный водитель"

    // Получаем trip_id из первого сообщения
    const tripResult = await sql`
      SELECT trip_id FROM trip_messages WHERE id = ${messageId}
    `

    if (tripResult.length === 0) {
      return NextResponse.json({ success: false, error: "Trip message not found" }, { status: 404 })
    }

    const tripId = tripResult[0].trip_id

    // Получаем ВСЕ активные сообщения для этого пользователя и рейса
    // включая новые рейсы со статусом 'sent'
    const messagesResult = await sql`
      SELECT DISTINCT
        tm.id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment
      FROM trip_messages tm
      WHERE tm.trip_id = ${tripId} 
        AND tm.phone = ${phone}
        AND tm.status = 'sent'
        AND tm.trip_identifier IS NOT NULL
      ORDER BY tm.trip_identifier
    `

    console.log(
      `Found ${messagesResult.length} messages to resend:`,
      messagesResult.map((m) => m.trip_identifier),
    )

    if (messagesResult.length === 0) {
      return NextResponse.json({ success: false, error: "No messages found to resend" }, { status: 404 })
    }

    // Собираем данные о рейсах
    const trips: TripData[] = []

    for (const message of messagesResult) {
      console.log(`Processing trip: ${message.trip_identifier}`)

      // Получаем точки для каждого рейса
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
        WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${message.trip_identifier}
        ORDER BY tp.point_type DESC, tp.point_num
      `

      console.log(`Found ${pointsResult.length} points for trip ${message.trip_identifier}`)

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
      })
    }

    console.log(`Prepared ${trips.length} trips for sending`)

    // Формируем и отправляем сообщение
    const telegramMessage = formatTripMessage(driverName, trips, isCorrection, tripId)
    const sendResult = await sendTelegramMessage(user.telegram_id, telegramMessage)

    if (sendResult.success) {
      // Обновляем статусы всех сообщений
      const messageIdsToUpdate = messagesResult.map((m) => m.id)

      for (const msgId of messageIdsToUpdate) {
        await sql`
          UPDATE trip_messages 
          SET telegram_message_id = ${sendResult.messageId},
              response_status = 'pending',
              response_comment = NULL,
              response_at = NULL,
              sent_at = CURRENT_TIMESTAMP
          WHERE id = ${msgId}
        `
      }

      console.log(`Successfully sent correction to ${user.telegram_id}, updated ${messageIdsToUpdate.length} messages`)

      return NextResponse.json({
        success: true,
        message: "Correction sent successfully",
        telegram_message_id: sendResult.messageId,
        trips_count: trips.length,
        updated_messages: messageIdsToUpdate.length,
      })
    } else {
      console.error("Failed to send Telegram message:", sendResult.error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send Telegram message",
          details: sendResult.error,
        },
        { status: 500 },
      )
    }
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
