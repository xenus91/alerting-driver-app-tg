import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, messageIds } = await request.json()

  try {
    console.log(`=== RESENDING COMBINED MESSAGE ===`)
    console.log(`Primary message ID: ${messageId}`)
    console.log(`Phone: ${phone}`)
    console.log(`All message IDs: ${messageIds}`)

    // Получаем информацию о пользователе
    const userResult = await sql`
      SELECT u.telegram_id, u.first_name, u.full_name
      FROM users u
      WHERE u.phone = ${phone}
      LIMIT 1
    `

    if (userResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      )
    }

    const user = userResult[0]

    if (!user.telegram_id) {
      return NextResponse.json(
        {
          success: false,
          error: "User telegram_id not found",
        },
        { status: 400 },
      )
    }

    // Получаем все сообщения водителя для этой рассылки
    const messagesResult = await sql`
      SELECT DISTINCT
        tm.trip_id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment
      FROM trip_messages tm
      WHERE tm.id = ANY(${messageIds})
      ORDER BY tm.trip_identifier
    `

    if (messagesResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Messages not found",
        },
        { status: 404 },
      )
    }

    const tripId = messagesResult[0].trip_id

    // Получаем все точки для всех рейсов водителя
    const tripsData = []

    for (const message of messagesResult) {
      // Получаем точки для каждого рейса
      const pointsResult = await sql`
        SELECT tp.*, p.point_name, p.point_id as point_short_id, p.door_open_1, p.door_open_2, p.door_open_3
        FROM trip_points tp
        JOIN points p ON tp.point_id = p.id
        WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${message.trip_identifier}
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
        }

        if (point.point_type === "P") {
          loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo)
        }
      }

      tripsData.push({
        trip_identifier: message.trip_identifier,
        vehicle_number: message.vehicle_number,
        planned_loading_time: message.planned_loading_time,
        driver_comment: message.driver_comment,
        loading_points: loading_points,
        unloading_points: unloading_points,
      })
    }

    console.log(`Prepared ${tripsData.length} trips for resending`)

    // Отправляем объединенное сообщение в Telegram
    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_id,
      tripsData,
      user.first_name || "Водитель",
      messageId, // Используем ID первого сообщения для callback
    )

    // Обновляем статус всех сообщений водителя
    const updateResult = await sql`
      UPDATE trip_messages 
      SET status = 'sent', 
          sent_at = ${new Date().toISOString()},
          error_message = NULL
      WHERE id = ANY(${messageIds})
      RETURNING *
    `

    console.log(`Updated ${updateResult.length} messages status to sent`)

    return NextResponse.json({
      success: true,
      message: "Combined message resent successfully",
      messageIds: messageIds,
      updatedMessages: updateResult.length,
    })
  } catch (error) {
    console.error("Error resending combined message:", error)

    // Обновляем статус сообщений как ошибка
    try {
      await sql`
        UPDATE trip_messages 
        SET status = 'error', 
            error_message = ${error instanceof Error ? error.message : "Unknown error"}
        WHERE id = ANY(${messageIds})
      `
    } catch (updateError) {
      console.error("Error updating message status:", updateError)
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend combined message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
