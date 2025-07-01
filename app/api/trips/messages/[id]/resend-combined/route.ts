import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons, editMessageReplyMarkup } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, isCorrection = false, deletedTrips = [] } = await request.json()

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

    // Получаем trip_id из сообщения
    const tripResult = await sql`
      SELECT trip_id FROM trip_messages WHERE id = ${messageId}
    `

    if (tripResult.length === 0) {
      return NextResponse.json({ success: false, error: "Trip message not found" }, { status: 404 })
    }

    const tripId = tripResult[0].trip_id

    // Удаляем кнопки у предыдущих сообщений этого рейса
    const previousMessages = await sql`
      SELECT DISTINCT telegram_message_id
      FROM trip_messages
      WHERE trip_id = ${tripId}
        AND phone = ${phone}
        AND telegram_message_id IS NOT NULL
        AND id != ${messageId}
    `

    for (const msg of previousMessages) {
      try {
        await editMessageReplyMarkup(
          user.telegram_id,
          msg.telegram_message_id,
          { inline_keyboard: [] }
        )
        console.log(`Removed buttons from previous message ${msg.telegram_message_id}`)
      } catch (error) {
        console.error(`Error removing buttons from message ${msg.telegram_message_id}:`, error)
      }
    }

    // Формируем условие для исключения удаленных рейсов
    let messagesQuery = sql`
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
    `

    if (deletedTrips.length > 0) {
      messagesQuery = sql`${messagesQuery} AND tm.trip_identifier NOT IN (${sql(deletedTrips)})`
    }

    messagesQuery = sql`${messagesQuery} ORDER BY tm.trip_identifier`

    // Получаем активные сообщения
    const messagesResult = await messagesQuery

    if (messagesResult.length === 0) {
      return NextResponse.json({ success: false, error: "No messages found to resend" }, { status: 404 })
    }

    // Собираем данные о рейсах
    const trips = await Promise.all(messagesResult.map(async (message) => {
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

      const loading_points = pointsResult
        .filter(p => p.point_type === "P")
        .map(p => ({
          point_id: p.point_id,
          point_name: p.point_name,
          door_open_1: p.door_open_1,
          door_open_2: p.door_open_2,
          door_open_3: p.door_open_3,
          latitude: p.latitude,
          longitude: p.longitude,
        }))

      const unloading_points = pointsResult
        .filter(p => p.point_type === "D")
        .map(p => ({
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
        loading_points,
        unloading_points,
      }
    }))

    // Отправляем сообщение
    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_id,
      trips,
      driverName,
      messageId,
      isCorrection
    )

    // Обновляем статусы сообщений
    const messageIdsToUpdate = messagesResult.map(m => m.id)
    await sql`
      UPDATE trip_messages 
      SET telegram_message_id = ${telegramResult.message_id},
          response_status = 'pending',
          response_comment = NULL,
          response_at = NULL,
          sent_at = CURRENT_TIMESTAMP
      WHERE id IN (${sql(messageIdsToUpdate)})
    `

    return NextResponse.json({
      success: true,
      message: "Correction sent successfully",
      telegram_message_id: telegramResult.message_id,
      trips_count: trips.length,
      updated_messages: messageIdsToUpdate.length,
    })
    
  } catch (error) {
    console.error("Error resending combined message:", error)
    
    try {
      await sql`
        UPDATE trip_messages 
        SET status = 'error', 
            error_message = ${error instanceof Error ? error.message : "Unknown error"}
        WHERE id = ${messageId}
      `
    } catch (updateError) {
      console.error("Error updating message status:", updateError)
    }

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
