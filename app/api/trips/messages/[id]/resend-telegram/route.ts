import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendTripMessageWithButtons, deleteMessage } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)

  try {
    // Получаем информацию о сообщении
    const messageResult = await sql`
      SELECT tm.*, u.telegram_id, u.first_name, u.full_name, tm.telegram_message_id
      FROM trip_messages tm
      JOIN users u ON tm.phone = u.phone
      WHERE tm.id = ${messageId}
      LIMIT 1
    `

    if (messageResult.length === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 })
    }

    const message = messageResult[0]

    // Удаляем предыдущее сообщение
    if (message.telegram_message_id) {
      await deleteMessage(message.telegram_id, message.telegram_message_id)
    }

    // Получаем точки для рейса
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
      WHERE tp.trip_id = ${message.trip_id} 
        AND (tp.trip_identifier = ${message.trip_identifier} OR tp.trip_identifier IS NULL)
      ORDER BY tp.point_type DESC, tp.point_num
    `

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

    // Отправляем сообщение в Telegram
    const telegramResult = await sendTripMessageWithButtons(
      message.telegram_id,
      {
        trip_identifier: message.trip_identifier,
        vehicle_number: message.vehicle_number,
        planned_loading_time: message.planned_loading_time,
        driver_comment: message.driver_comment,
      },
      loading_points,
      unloading_points,
      message.first_name || "Водитель",
      messageId
    )

    // Обновляем статус сообщения
    await sql`
      UPDATE trip_messages 
      SET status = 'sent', 
          sent_at = ${new Date().toISOString()},
          error_message = NULL,
          telegram_message_id = ${telegramResult.message_id}
      WHERE id = ${messageId}
    `

    return NextResponse.json({
      success: true,
      message: "Message resent successfully",
      messageId: messageId,
      telegramMessageId: telegramResult.message_id,
    })
  } catch (error) {
    console.error("Error resending message:", error)
    await sql`
      UPDATE trip_messages 
      SET status = 'error', 
          error_message = ${error instanceof Error ? error.message : "Unknown error"}
      WHERE id = ${messageId}
    `
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
