import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)
  const { phone, messageIds, isCorrection = false } = await request.json()

  try {
    console.log(`=== RESENDING COMBINED MESSAGE ===`)
    console.log(`Primary message ID: ${messageId}`)
    console.log(`Phone: ${phone}`)
    console.log(`All message IDs: ${messageIds}`)
    console.log(`Is correction: ${isCorrection}`)

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

    // Получаем все точки для всех рейсов водителя с координатами
    const tripsData = []

    for (const message of messagesResult) {
      // Получаем точки для каждого рейса с координатами
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
        WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${message.trip_identifier}
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
      messageId,
      isCorrection, // Передаем флаг корректировки
    )

    // Обновляем статус всех сообщений водителя
    // Если это корректировка, сбрасываем статус подтверждения
    let updateResult
    if (isCorrection) {
      // Для корректировки: статус sent, response_status pending, response_at null, обновляем sent_at
      updateResult = await sql`
        UPDATE trip_messages 
        SET status = 'sent', 
            sent_at = ${new Date().toISOString()},
            error_message = NULL,
            response_status = 'pending',
            response_at = NULL
        WHERE id = ANY(${messageIds})
        RETURNING *
      `
      console.log(`Correction sent - reset response status to pending for ${updateResult.length} messages`)
    } else {
      // Для обычной повторной отправки: только обновляем статус отправки
      updateResult = await sql`
        UPDATE trip_messages 
        SET status = 'sent', 
            sent_at = ${new Date().toISOString()},
            error_message = NULL
        WHERE id = ANY(${messageIds})
        RETURNING *
      `
      console.log(`Regular resend - updated ${updateResult.length} messages status to sent`)
    }

    return NextResponse.json({
      success: true,
      message: isCorrection
        ? "Correction sent successfully - driver needs to confirm again"
        : "Combined message resent successfully",
      messageIds: messageIds,
      updatedMessages: updateResult.length,
      isCorrection: isCorrection,
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
