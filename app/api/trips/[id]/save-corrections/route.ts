import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, driver_phone, corrections, deletedTrips } = await request.json()

  try {
    console.log(`Saving corrections for trip ${tripId}, phone: ${phone}`)
    console.log(`Corrections count: ${corrections.length}`)
    console.log(`Deleted trips: ${deletedTrips}`)

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
      WHERE trip_id = ${tripId} 
        AND phone = ${phone}
        AND telegram_message_id IS NOT NULL
      LIMIT 1
    `

    let previousTelegramMessageId = null
    if (previousMessageResult.length > 0) {
      previousTelegramMessageId = previousMessageResult[0].telegram_message_id
    }

    // Удаляем старые записи для этого рейса и водителя
    await sql`
      DELETE FROM trip_points 
      WHERE trip_id = ${tripId} AND driver_phone = ${driver_phone}
    `

    await sql`
      DELETE FROM trip_messages 
      WHERE trip_id = ${tripId} AND phone = ${phone}
    `

    // Группируем корректировки по trip_identifier
    const tripGroups = new Map<string, any[]>()
    for (const correction of corrections) {
      const key = correction.trip_identifier
      if (!tripGroups.has(key)) {
        tripGroups.set(key, [])
      }
      tripGroups.get(key)!.push(correction)
    }

    const messageIds = []
    const trips = []

    // Обрабатываем каждую группу рейсов
    for (const [tripIdentifier, tripCorrections] of tripGroups) {
      console.log(`Processing trip group: ${tripIdentifier} with ${tripCorrections.length} corrections`)

      // Берем данные рейса из первой корректировки
      const firstCorrection = tripCorrections[0]

      // Создаем запись в trip_messages
      const messageResult = await sql`
        INSERT INTO trip_messages (
          trip_id, trip_identifier, phone, telegram_id, vehicle_number, 
          planned_loading_time, driver_comment, status, sent_at
        ) VALUES (
          ${tripId}, ${tripIdentifier}, ${phone}, ${user.telegram_id}, 
          ${firstCorrection.vehicle_number}, ${firstCorrection.planned_loading_time}, 
          ${firstCorrection.driver_comment}, 'sent', CURRENT_TIMESTAMP
        ) RETURNING id
      `

      const messageId = messageResult[0].id
      messageIds.push(messageId)

      // Создаем записи в trip_points для каждой корректировки
      const loading_points = []
      const unloading_points = []
      const all_points = []

      for (const correction of tripCorrections) {
        await sql`
          INSERT INTO trip_points (
            trip_id, trip_identifier, driver_phone, point_id, point_type, point_num
          ) VALUES (
            ${tripId}, ${tripIdentifier}, ${driver_phone}, 
            ${correction.point_id}, ${correction.point_type}, ${correction.point_num}
          )
        `

        // Получаем полную информацию о точке
        const pointResult = await sql`
          SELECT point_id, point_name, adress, latitude, longitude, 
                 door_open_1, door_open_2, door_open_3
          FROM points 
          WHERE id = ${correction.point_id}
        `

        if (pointResult.length > 0) {
          const point = pointResult[0]
          const pointInfo = {
            point_id: point.point_id,
            point_name: point.point_name,
            adress: point.adress,
            door_open_1: point.door_open_1,
            door_open_2: point.door_open_2,
            door_open_3: point.door_open_3,
            latitude: point.latitude,
            longitude: point.longitude,
            point_type: correction.point_type,
            point_num: correction.point_num,
          }

          all_points.push(pointInfo)
        }
      }

      // Сортируем все точки по point_num
      all_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Разделяем по типам, сохраняя порядок
      for (const point of all_points) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          adress: point.adress,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          point_num: point.point_num,
        }

        if (point.point_type === "P") {
          loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo)
        }
      }

      trips.push({
        trip_identifier: tripIdentifier,
        vehicle_number: firstCorrection.vehicle_number,
        planned_loading_time: firstCorrection.planned_loading_time,
        driver_comment: firstCorrection.driver_comment || "",
        loading_points,
        unloading_points,
      })
    }

    console.log(`Prepared ${trips.length} trips for sending`)

    // Отправляем корректировку через Telegram
    const { message_id, messageText } = await sendMultipleTripMessageWithButtons(
      Number(user.telegram_id),
      trips,
      driverName,
      messageIds[0], // Используем первый messageId для callback_data
      true, // isCorrection = true
      false, // isResend = false
      previousTelegramMessageId,
    )

    // Обновляем все сообщения с telegram_message_id и текстом
    for (const msgId of messageIds) {
      await sql`
        UPDATE trip_messages 
        SET telegram_message_id = ${message_id},
            response_status = 'pending',
            response_comment = NULL,
            response_at = NULL,
            message = ${messageText}
        WHERE id = ${msgId}
      `
    }

    console.log(`Successfully sent correction to ${user.telegram_id}, updated ${messageIds.length} messages`)

    return NextResponse.json({
      success: true,
      message: "Corrections saved and sent successfully",
      telegram_message_id: message_id,
      trips_count: trips.length,
      updated_messages: messageIds.length,
    })
  } catch (error) {
    console.error("Error saving corrections:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save corrections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
