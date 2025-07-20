import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)

  try {
    const { phone, driver_phone, corrections, deletedTrips } = await request.json()

    console.log("=== SAVE CORRECTIONS REQUEST ===")
    console.log("Trip ID:", tripId)
    console.log("Phone:", phone)
    console.log("Driver Phone:", driver_phone)
    console.log("Corrections:", JSON.stringify(corrections, null, 2))
    console.log("Deleted Trips:", deletedTrips)

    if (!corrections || corrections.length === 0) {
      return NextResponse.json({ success: false, error: "No corrections provided" }, { status: 400 })
    }

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
    const tripGroups = new Map()

    for (const correction of corrections) {
      const key = correction.trip_identifier
      if (!tripGroups.has(key)) {
        tripGroups.set(key, {
          trip_identifier: correction.trip_identifier,
          vehicle_number: correction.vehicle_number,
          planned_loading_time: correction.planned_loading_time,
          driver_comment: correction.driver_comment,
          message_id: correction.message_id,
          points: [],
        })
      }

      tripGroups.get(key).points.push({
        point_type: correction.point_type,
        point_num: correction.point_num,
        point_id: correction.point_id,
        point_name: correction.point_name,
      })
    }

    // Создаем новые записи
    const messageIds = []
    const trips = []

    for (const [tripIdentifier, tripData] of tripGroups) {
      console.log(`Processing trip: ${tripIdentifier}`)

      // Создаем запись в trip_messages
      const messageResult = await sql`
        INSERT INTO trip_messages (
          trip_id, trip_identifier, phone, telegram_id, vehicle_number, 
          planned_loading_time, driver_comment, status, created_at
        ) VALUES (
          ${tripId}, ${tripData.trip_identifier}, ${phone}, ${user.telegram_id}, 
          ${tripData.vehicle_number}, ${tripData.planned_loading_time}, 
          ${tripData.driver_comment}, 'pending', NOW()
        ) RETURNING id
      `

      const messageId = messageResult[0].id
      messageIds.push(messageId)

      // Создаем записи в trip_points для каждой точки
      for (const point of tripData.points) {
        await sql`
          INSERT INTO trip_points (
            trip_id, trip_identifier, driver_phone, point_type, point_num, point_id
          ) VALUES (
            ${tripId}, ${tripData.trip_identifier}, ${driver_phone}, 
            ${point.point_type}, ${point.point_num}, ${point.point_id}
          )
        `
      }

      // Получаем полную информацию о точках для отправки сообщения
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
          p.longitude,
          p.adress
        FROM trip_points tp
        JOIN points p ON tp.point_id = p.id
        WHERE tp.trip_id = ${tripId} 
          AND tp.trip_identifier = ${tripData.trip_identifier}
          AND tp.driver_phone = ${driver_phone}
        ORDER BY tp.point_num
      `

      console.log(`Found ${pointsResult.length} points for trip ${tripIdentifier}`)

      const loading_points = []
      const unloading_points = []
      const all_points = [] // Временный массив для сортировки

      // Собираем все точки
      for (const point of pointsResult) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          adress: point.adress,
          point_type: point.point_type,
          point_num: point.point_num,
        }

        all_points.push(pointInfo)
      }

      // Сортируем по point_num
      all_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Разделяем по типам, сохраняя порядок
      for (const point of all_points) {
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
          loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo)
        }
      }

      trips.push({
        trip_identifier: tripData.trip_identifier,
        vehicle_number: tripData.vehicle_number,
        planned_loading_time: tripData.planned_loading_time,
        driver_comment: tripData.driver_comment || "",
        loading_points,
        unloading_points,
      })
    }

    console.log(`Prepared ${trips.length} trips for sending`)

    // Отправляем сообщение через новую функцию
    const { message_id, messageText } = await sendMultipleTripMessageWithButtons(
      Number(user.telegram_id),
      trips,
      driverName,
      messageIds[0],
      true, // isCorrection = true
      false, // isResend = false
      previousTelegramMessageId,
    )

    // Обновляем статусы всех сообщений
    for (const msgId of messageIds) {
      await sql`
        UPDATE trip_messages 
        SET telegram_message_id = ${message_id},
            status = 'sent',
            sent_at = CURRENT_TIMESTAMP,
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
