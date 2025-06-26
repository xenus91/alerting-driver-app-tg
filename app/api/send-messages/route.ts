import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendTripMessageWithButtons, sendMultipleTripMessageWithButtons } from "@/lib/telegram"
import { updateMessageStatus } from "@/lib/database"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()

    if (!tripId) {
      return NextResponse.json({ error: "Trip ID is required" }, { status: 400 })
    }

    console.log(`=== SENDING MESSAGES FOR TRIP ${tripId} ===`)

    // Получаем все неотправленные сообщения для этого рейса
    const pendingMessages = await sql`
      SELECT tm.*, u.telegram_id, u.first_name, u.full_name
      FROM trip_messages tm
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = ${tripId} AND tm.status = 'pending'
      ORDER BY tm.phone, tm.trip_identifier
    `

    console.log(`Found ${pendingMessages.length} pending messages`)

    if (pendingMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending messages to send",
        sent: 0,
        errors: 0,
      })
    }

    // Группируем сообщения по телефону
    const messagesByPhone = new Map()

    for (const message of pendingMessages) {
      if (!message.telegram_id) {
        console.log(`Skipping message ${message.id} - no telegram_id`)
        await updateMessageStatus(message.id, "error", "User not found in Telegram")
        continue
      }

      if (!messagesByPhone.has(message.phone)) {
        messagesByPhone.set(message.phone, [])
      }
      messagesByPhone.get(message.phone).push(message)
    }

    console.log(`Grouped messages by ${messagesByPhone.size} phones`)

    let sentCount = 0
    let errorCount = 0

    // Отправляем сообщения для каждого телефона
    for (const [phone, messages] of messagesByPhone) {
      try {
        console.log(`Processing ${messages.length} messages for phone ${phone}`)

        const user = messages[0] // Все сообщения для одного телефона имеют одинакового пользователя
        const messageIds = messages.map((m) => m.id)

        // Получаем уникальные рейсы для этого телефона
        const uniqueTrips = new Map()
        for (const message of messages) {
          if (!uniqueTrips.has(message.trip_identifier)) {
            uniqueTrips.set(message.trip_identifier, message)
          }
        }

        const tripsArray = Array.from(uniqueTrips.values())
        console.log(`Found ${tripsArray.length} unique trips for phone ${phone}`)

        if (tripsArray.length === 1) {
          // Одиночный рейс - отправляем простое сообщение
          const trip = tripsArray[0]

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
            WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${trip.trip_identifier}
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

          const tripData = {
            trip_identifier: trip.trip_identifier,
            vehicle_number: trip.vehicle_number,
            planned_loading_time: trip.planned_loading_time,
            driver_comment: trip.driver_comment,
          }

          console.log(`Sending single trip message for ${trip.trip_identifier}`)

          const telegramResult = await sendTripMessageWithButtons(
            user.telegram_id,
            tripData,
            loading_points,
            unloading_points,
            user.first_name || "Водитель",
            messageIds[0],
          )

          // Обновляем статус сообщения
          await updateMessageStatus(messageIds[0], "sent", undefined, telegramResult.message_id)
          sentCount++
        } else {
          // Множественные рейсы - отправляем объединенное сообщение
          const tripsData = []

          for (const trip of tripsArray) {
            // Получаем точки для каждого рейса
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
              WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${trip.trip_identifier}
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

            tripsData.push({
              trip_identifier: trip.trip_identifier,
              vehicle_number: trip.vehicle_number,
              planned_loading_time: trip.planned_loading_time,
              driver_comment: trip.driver_comment,
              loading_points: loading_points,
              unloading_points: unloading_points,
            })
          }

          console.log(`Sending combined message for ${tripsData.length} trips`)

          const telegramResult = await sendMultipleTripMessageWithButtons(
            user.telegram_id,
            tripsData,
            user.first_name || "Водитель",
            messageIds[0],
          )

          // Обновляем статус всех сообщений для этого телефона
          for (const messageId of messageIds) {
            await updateMessageStatus(messageId, "sent", undefined, telegramResult.message_id)
          }
          sentCount += messageIds.length
        }

        console.log(`Successfully sent messages for phone ${phone}`)
      } catch (error) {
        console.error(`Error sending messages for phone ${phone}:`, error)

        // Обновляем статус всех сообщений для этого телефона как ошибка
        for (const message of messages) {
          await updateMessageStatus(message.id, "error", error instanceof Error ? error.message : "Unknown error")
        }
        errorCount += messages.length
      }
    }

    console.log(`=== SENDING COMPLETED ===`)
    console.log(`Sent: ${sentCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      success: true,
      message: `Messages processed: ${sentCount} sent, ${errorCount} errors`,
      sent: sentCount,
      errors: errorCount,
    })
  } catch (error) {
    console.error("Error in send-messages:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send messages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
