import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { phone, driver_phone, messageIds, isCorrection = false } = body

    console.log("=== RESEND COMBINED MESSAGE ===")
    console.log("Message ID:", params.id)
    console.log("Phone:", phone)
    console.log("Driver Phone:", driver_phone)
    console.log("Message IDs:", messageIds)
    console.log("Is Correction:", isCorrection)

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ success: false, error: "No message IDs provided" }, { status: 400 })
    }

    // Получаем информацию о пользователе
    const userResult = await query("SELECT first_name, telegram_id FROM users WHERE phone = $1", [phone])

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const user = userResult.rows[0]

    // Получаем все рейсы для указанных message_id
    const tripsResult = await query(
      `SELECT DISTINCT tm.trip_identifier, tm.vehicle_number, tm.planned_loading_time, 
              tm.driver_comment, tm.message_id, tm.telegram_message_id
       FROM trip_messages tm 
       WHERE tm.phone = $1 AND tm.message_id = ANY($2)
       ORDER BY tm.planned_loading_time`,
      [phone, messageIds],
    )

    if (tripsResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No trips found for the provided message IDs" },
        { status: 404 },
      )
    }

    console.log(`Found ${tripsResult.rows.length} trips to resend`)

    // Формируем данные для отправки сообщения
    const trips = []
    let previousTelegramMessageId = null

    for (const tripRow of tripsResult.rows) {
      // Сохраняем telegram_message_id первого рейса для удаления старого сообщения
      if (!previousTelegramMessageId && tripRow.telegram_message_id) {
        previousTelegramMessageId = tripRow.telegram_message_id
      }

      // Получаем точки для каждого рейса, отсортированные по point_num
      const pointsResult = await query(
        `SELECT tp.point_type, tp.point_num, tp.point_id, tp.point_name,
                p.door_open_1, p.door_open_2, p.door_open_3, 
                p.latitude, p.longitude, p.adress
         FROM trip_points tp
         LEFT JOIN points p ON tp.point_id = p.point_id
         WHERE tp.trip_identifier = $1 AND tp.phone = $2
         ORDER BY tp.point_num`,
        [tripRow.trip_identifier, phone],
      )

      const loading_points: any[] = []
      const unloading_points: any[] = []

      // Разделяем точки по типам, сохраняя порядок по point_num
      for (const point of pointsResult.rows) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          adress: point.adress,
          point_num: point.point_num?.toString(),
        }

        if (point.point_type === "P") {
          loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo)
        }
      }

      trips.push({
        trip_identifier: tripRow.trip_identifier,
        vehicle_number: tripRow.vehicle_number,
        planned_loading_time: tripRow.planned_loading_time,
        driver_comment: tripRow.driver_comment,
        loading_points,
        unloading_points,
      })
    }

    console.log("Sending combined message to Telegram...")
    console.log(`User: ${user.first_name}, Telegram ID: ${user.telegram_id}`)
    console.log(`Previous Telegram Message ID: ${previousTelegramMessageId}`)

    // Используем первый message_id для отправки
    const messageId = tripsResult.rows[0].message_id

    // Отправляем сообщение в Telegram
    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_id,
      trips,
      user.first_name,
      messageId,
      isCorrection, // передаем isCorrection из запроса
      !isCorrection, // isResend = true если не корректировка
      previousTelegramMessageId,
    )

    // Обновляем telegram_message_id для всех затронутых рейсов
    for (const messageIdToUpdate of messageIds) {
      await query(
        `UPDATE trip_messages 
         SET telegram_message_id = $1, updated_at = NOW()
         WHERE message_id = $2 AND phone = $3`,
        [telegramResult.message_id, messageIdToUpdate, phone],
      )
    }

    console.log("Combined message sent successfully")

    return NextResponse.json({
      success: true,
      message: "Combined message sent successfully",
      telegram_message_id: telegramResult.message_id,
      trips_sent: trips.length,
      message_ids_updated: messageIds.length,
    })
  } catch (error) {
    console.error("Error sending combined message:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send combined message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
