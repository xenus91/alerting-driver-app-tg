import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendTripMessageWithButtons, removeButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)

  try {
    console.log(`=== RESENDING SINGLE MESSAGE ===`)
    console.log(`Message ID: ${messageId}`)

    // Получаем информацию о сообщении
    const messageResult = await sql`
      SELECT tm.*, u.telegram_id, u.first_name, u.full_name, tm.telegram_message_id
      FROM trip_messages tm
      JOIN users u ON tm.phone = u.phone
      WHERE tm.id = ${messageId}
      LIMIT 1
    `

    if (messageResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Message not found",
        },
        { status: 404 },
      )
    }

    const message = messageResult[0]

    if (!message.telegram_id) {
      return NextResponse.json(
        {
          success: false,
          error: "User telegram_id not found",
        },
        { status: 400 },
      )
    }

    // Удаляем кнопки предыдущего сообщения если оно есть
if (message.telegram_message_id) {
  console.log(`Removing buttons from message ID: ${message.telegram_message_id}`);
  const buttonsRemoved = await removeButtons(message.telegram_id, message.telegram_message_id);
  if (!buttonsRemoved) {
    console.warn('Failed to remove buttons from previous message');
  }
}

    // Получаем точки для рейса с координатами
    const pointsResult = await sql`
      SELECT 
        tp.*, 
        p.point_name, 
        p.point_id as point_short_id, 
        p.door_open_1, 
        p.door_open_2, 
        p.door_open_3,
        p.latitude,
        p.longitude
      FROM trip_points tp
      JOIN points p ON tp.point_id = p.id
      WHERE tp.trip_id = ${message.trip_id} AND tp.trip_identifier = ${message.trip_identifier}
      ORDER BY tp.point_type DESC, tp.point_num
    `

    console.log(
      `Points for trip ${message.trip_identifier}:`,
      pointsResult.map((p) => ({
        id: p.point_short_id,
        name: p.point_name,
        lat: p.latitude,
        lng: p.longitude,
        type: p.point_type,
      })),
    )

    const loading_points = []
    const unloading_points = []

    for (const point of pointsResult) {
      const pointInfo = {
        point_id: point.point_short_id,
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

    const tripData = {
      trip_identifier: message.trip_identifier,
      vehicle_number: message.vehicle_number,
      planned_loading_time: message.planned_loading_time,
      driver_comment: message.driver_comment,
    }

    console.log(`Prepared trip data for resending:`, tripData)

    // Отправляем сообщение в Telegram
    const telegramResult = await sendTripMessageWithButtons(
      message.telegram_id,
      tripData,
      loading_points,
      unloading_points,
      message.first_name || "Водитель",
      messageId,
    )

    // Обновляем статус сообщения
    const updateResult = await sql`
      UPDATE trip_messages 
      SET status = 'sent', 
          sent_at = ${new Date().toISOString()},
          error_message = NULL,
          telegram_message_id = ${telegramResult.message_id}
      WHERE id = ${messageId}
      RETURNING *
    `

    console.log(`Updated message status to sent`)

    return NextResponse.json({
      success: true,
      message: "Message resent successfully",
      messageId: messageId,
      telegramMessageId: telegramResult.message_id,
    })
  } catch (error) {
    console.error("Error resending message:", error)

    // Обновляем статус сообщения как ошибка
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
