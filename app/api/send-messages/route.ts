import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const { campaignId } = await request.json()
    console.log(`=== SEND MESSAGES API CALLED ===`)
    console.log(`Received campaignId: ${campaignId}`)

    if (!campaignId) {
      return NextResponse.json({ error: "ID кампании обязателен" }, { status: 400 })
    }

    // Если передан "latest", найдем последний рейс
    let actualTripId = campaignId
    if (campaignId === "latest") {
      const allTripsResult = await sql`SELECT * FROM trips ORDER BY created_at DESC LIMIT 1`
      if (allTripsResult.rows.length === 0) {
        return NextResponse.json({ error: "Нет рейсов для отправки" }, { status: 400 })
      }
      actualTripId = allTripsResult.rows[0].id
      console.log(`Using latest trip ID: ${actualTripId}`)
    }

    console.log(`Processing trip ID: ${actualTripId}`)

    // Получаем все сообщения рейса
    const messagesResult = await sql`
      SELECT tm.*, u.telegram_chat_id, u.first_name, u.name
      FROM trip_messages tm
      JOIN users u ON tm.phone = u.phone
      WHERE tm.trip_id = ${actualTripId}
    `
    const messages = messagesResult.rows
    console.log(`Found ${messages.length} total messages for trip ${actualTripId}`)

    if (messages.length === 0) {
      console.log(`No messages found for trip ${actualTripId}`)
      return NextResponse.json({ error: "Нет сообщений для данного рейса" }, { status: 400 })
    }

    const pendingMessages = messages.filter((msg) => msg.status === "pending" && msg.telegram_chat_id)
    console.log(`Found ${pendingMessages.length} pending messages with telegram_chat_id`)

    if (pendingMessages.length === 0) {
      console.log(`No pending messages with telegram_chat_id found`)
      return NextResponse.json(
        {
          error: "Нет сообщений для отправки (все уже отправлены или нет telegram_chat_id)",
          total: messages.length,
          pending: pendingMessages.length,
        },
        { status: 400 },
      )
    }

    // Группируем сообщения по телефону
    const messagesByPhone = new Map<string, typeof pendingMessages>()
    for (const message of pendingMessages) {
      if (!messagesByPhone.has(message.phone)) {
        messagesByPhone.set(message.phone, [])
      }
      messagesByPhone.get(message.phone)!.push(message)
    }

    console.log(`Grouped messages by ${messagesByPhone.size} unique phones`)

    const results = {
      total: pendingMessages.length,
      sent: 0,
      errors: 0,
      details: [] as any[],
    }

    // Отправляем сообщения по телефонам
    for (const [phone, phoneMessages] of messagesByPhone) {
      try {
        console.log(`=== PROCESSING PHONE ${phone} ===`)
        console.log(`Messages for this phone: ${phoneMessages.length}`)

        const firstName = phoneMessages[0].first_name || phoneMessages[0].name || "Водитель"

        // Группируем сообщения по trip_identifier
        const tripsByIdentifier = new Map<string, typeof phoneMessages>()
        for (const message of phoneMessages) {
          const tripId = message.trip_identifier || "unknown"
          if (!tripsByIdentifier.has(tripId)) {
            tripsByIdentifier.set(tripId, [])
          }
          tripsByIdentifier.get(tripId)!.push(message)
        }

        // Получаем данные о пунктах для каждого рейса отдельно
        const trips = []
        for (const [tripIdentifier, tripMessages] of tripsByIdentifier) {
          const firstMessage = tripMessages[0]

          console.log(`Getting points for trip_identifier: ${tripIdentifier}`)

          // Получаем пункты погрузки для конкретного trip_identifier
          const loadingPointsResult = await sql`
            SELECT DISTINCT tp.point_id, tp.point_num, p.point_name, p.door_open_1, p.door_open_2, p.door_open_3
            FROM trip_points tp
            LEFT JOIN points p ON tp.point_id = p.point_id
            WHERE tp.trip_identifier = ${tripIdentifier} 
            AND tp.point_type = 'P'
            ORDER BY tp.point_num
          `

          // Получаем пункты разгрузки для конкретного trip_identifier
          const unloadingPointsResult = await sql`
            SELECT DISTINCT tp.point_id, tp.point_num, p.point_name, p.door_open_1, p.door_open_2, p.door_open_3
            FROM trip_points tp
            LEFT JOIN points p ON tp.point_id = p.point_id
            WHERE tp.trip_identifier = ${tripIdentifier} 
            AND tp.point_type = 'D'
            ORDER BY tp.point_num
          `

          console.log(`Loading points for ${tripIdentifier}:`, loadingPointsResult.rows)
          console.log(`Unloading points for ${tripIdentifier}:`, unloadingPointsResult.rows)

          trips.push({
            trip_identifier: tripIdentifier,
            vehicle_number: firstMessage.vehicle_number || "Не указан",
            planned_loading_time: firstMessage.planned_loading_time || "Не указано",
            driver_comment: firstMessage.driver_comment || "",
            loading_points: loadingPointsResult.rows.map((p: any) => ({
              point_id: p.point_id,
              point_name: p.point_name || `Пункт ${p.point_id}`,
              door_open_1: p.door_open_1,
              door_open_2: p.door_open_2,
              door_open_3: p.door_open_3,
            })),
            unloading_points: unloadingPointsResult.rows.map((p: any) => ({
              point_id: p.point_id,
              point_name: p.point_name || `Пункт ${p.point_id}`,
              door_open_1: p.door_open_1,
              door_open_2: p.door_open_2,
              door_open_3: p.door_open_3,
            })),
          })
        }

        console.log(`Prepared trips data:`, JSON.stringify(trips, null, 2))

        // Отправляем объединенное сообщение
        const telegramResult = await sendMultipleTripMessageWithButtons(
          phoneMessages[0].telegram_chat_id!,
          trips,
          firstName,
          phoneMessages[0].id, // Используем ID первого сообщения для callback
        )

        console.log(`Telegram API result:`, telegramResult)

        // Обновляем статус всех сообщений для этого телефона
        for (const message of phoneMessages) {
          await sql`UPDATE trip_messages SET status = 'sent' WHERE id = ${message.id}`
          results.sent++
        }

        results.details.push({
          phone: phone,
          status: "sent",
          user_name: firstName,
          trips_count: trips.length,
          telegram_message_id: telegramResult.message_id,
        })

        console.log(`Messages sent successfully to ${phone}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
        console.error(`Error sending messages to ${phone}:`, errorMessage)

        // Обновляем статус всех сообщений для этого телефона как ошибка
        for (const message of phoneMessages) {
          await sql`UPDATE trip_messages SET status = 'error', error_message = ${errorMessage} WHERE id = ${message.id}`
          results.errors++
        }

        results.details.push({
          phone: phone,
          status: "error",
          error: errorMessage,
        })
      }

      // Задержка между отправками
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(`=== MESSAGE SENDING COMPLETE ===`)
    console.log(`Sent: ${results.sent}, Errors: ${results.errors}`)

    return NextResponse.json({
      success: true,
      results: results,
    })
  } catch (error) {
    console.error("Send messages error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при отправке сообщений",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
