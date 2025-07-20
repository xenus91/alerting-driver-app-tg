import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { messageIds, isCorrection = false } = body

    console.log("=== RESEND COMBINED REQUEST ===")
    console.log("Message IDs:", messageIds)
    console.log("Is Correction:", isCorrection)

    if (!messageIds || messageIds.length === 0) {
      return NextResponse.json({ success: false, error: "No message IDs provided" })
    }

    // Получаем данные о рейсах для всех сообщений
    const placeholders = messageIds.map((_: any, index: number) => `$${index + 1}`).join(",")

    const tripDataResult = await query(
      `SELECT DISTINCT 
         tm.message_id,
         tm.trip_identifier,
         tm.vehicle_number,
         tm.planned_loading_time,
         tm.driver_comment,
         tm.telegram_message_id,
         u.first_name,
         u.telegram_id,
         u.phone
       FROM trip_messages tm
       JOIN users u ON tm.phone = u.phone
       WHERE tm.message_id IN (${placeholders})
       ORDER BY tm.planned_loading_time`,
      messageIds,
    )

    if (tripDataResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "No trips found" })
    }

    // Получаем все точки для всех рейсов
    const pointsResult = await query(
      `SELECT 
         tp.trip_identifier,
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
       JOIN points p ON tp.point_id = p.point_id
       JOIN trip_messages tm ON tp.trip_identifier = tm.trip_identifier
       WHERE tm.message_id IN (${placeholders})
       ORDER BY tp.point_num`,
      messageIds,
    )

    // Группируем данные по рейсам
    const tripsData = tripDataResult.rows.map((row: any) => ({
      trip_identifier: row.trip_identifier,
      vehicle_number: row.vehicle_number,
      planned_loading_time: row.planned_loading_time,
      driver_comment: row.driver_comment || "",
      loading_points: [] as any[],
      unloading_points: [] as any[],
    }))

    // Распределяем точки по рейсам
    pointsResult.rows.forEach((point: any) => {
      const trip = tripsData.find((t) => t.trip_identifier === point.trip_identifier)
      if (trip) {
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
          trip.loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          trip.unloading_points.push(pointInfo)
        }
      }
    })

    // Сортируем точки внутри каждого рейса по point_num
    tripsData.forEach((trip) => {
      trip.loading_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))
      trip.unloading_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))
    })

    const userData = tripDataResult.rows[0]
    const firstMessageId = messageIds[0]

    // Получаем предыдущий telegram_message_id для редактирования
    const previousTelegramMessageId = userData.telegram_message_id

    // Отправляем объединенное сообщение
    const telegramResult = await sendMultipleTripMessageWithButtons(
      userData.telegram_id,
      tripsData,
      userData.first_name,
      firstMessageId,
      isCorrection, // передаем isCorrection
      !isCorrection, // isResend = true если не корректировка
      previousTelegramMessageId,
    )

    // Обновляем telegram_message_id для первого сообщения
    await query(`UPDATE trip_messages SET telegram_message_id = $1 WHERE message_id = $2`, [
      telegramResult.message_id,
      firstMessageId,
    ])

    console.log("=== COMBINED MESSAGE SENT SUCCESSFULLY ===")

    return NextResponse.json({
      success: true,
      message: "Combined message sent successfully",
      telegramMessageId: telegramResult.message_id,
      tripsCount: tripsData.length,
    })
  } catch (error) {
    console.error("Error resending combined message:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to resend combined message",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
