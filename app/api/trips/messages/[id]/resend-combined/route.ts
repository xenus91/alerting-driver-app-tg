import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons, removeButtons } from "@/lib/telegram" // Добавлен removeButtons

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, messageIds, isCorrection = false, deletedTrips = [] } = await request.json()

  try {
    console.log(`Resending combined message for messageId: ${messageId}, phone: ${phone}`)
    console.log(`Is correction: ${isCorrection}, deleted trips:`, deletedTrips)

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

    const tripResult = await sql`
      SELECT trip_id FROM trip_messages WHERE id = ${messageId}
    `

    if (tripResult.length === 0) {
      return NextResponse.json({ success: false, error: "Trip message not found" }, { status: 404 })
    }

    const tripId = tripResult[0].trip_id

    // Получаем все активные сообщения для пользователя и рейса
    const messagesResult = await sql`
      SELECT DISTINCT
        tm.id,
        tm.telegram_message_id,
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

    if (messagesResult.length === 0) {
      return NextResponse.json({ success: false, error: "No messages found to resend" }, { status: 404 })
    }

    // Удаляем кнопки из всех предыдущих сообщений
    for (const message of messagesResult) {
       const telegramMessageId = Number(message.telegram_message_id)
      if (message.telegram_message_id) {
        console.log(`Removing buttons from message ID: ${message.telegram_message_id}`)
        const buttonsRemoved = await removeButtons(user.telegram_id, telegramMessageId)
        if (!buttonsRemoved) {
          console.warn(`Failed to remove buttons from message ID: ${message.id}`)
        }
      }
    }

    // Далее формируем и отправляем объединённое сообщение
    const trips = []

    for (const message of messagesResult) {
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

      const loading_points = []
      const unloading_points = []

      for (const point of pointsResult) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
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
        driver_comment: message.driver_comment || "",
        loading_points,
        unloading_points,
      })
    }

    console.log(`Prepared ${trips.length} trips for sending`)

    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_id,
      trips,
      driverName,
      messageId,
      isCorrection
    )

    // Обновляем статусы и telegram_message_id у всех сообщений
    const messageIdsToUpdate = messagesResult.map((m) => m.id)

    for (const msgId of messageIdsToUpdate) {
      await sql`
        UPDATE trip_messages 
        SET telegram_message_id = ${telegramResult.message_id},
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
      telegram_message_id: telegramResult.message_id,
      trips_count: trips.length,
      updated_messages: messageIdsToUpdate.length,
    })
  } catch (error) {
    console.error("Error resending combined message:", error)
    // Обновляем статус сообщений при ошибке
    try {
      for (const msgId of messageIds) {
        await sql`
          UPDATE trip_messages 
          SET status = 'error', 
              error_message = ${error instanceof Error ? error.message : "Unknown error"}
          WHERE id = ${msgId}
        `
      }
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
