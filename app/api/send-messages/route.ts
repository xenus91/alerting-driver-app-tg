import { type NextRequest, NextResponse } from "next/server"
import { getTrips, getTripMessages, updateMessageStatus, getUserByPhone, getTripPoints } from "@/lib/database"
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
      const allTrips = await getTrips()
      if (allTrips.length === 0) {
        return NextResponse.json({ error: "Нет рейсов для отправки" }, { status: 400 })
      }
      actualTripId = allTrips[0].id
      console.log(`Using latest trip ID: ${actualTripId}`)
    }

    console.log(`Processing trip ID: ${actualTripId}`)

    // Получаем все сообщения рейса
    const messages = await getTripMessages(actualTripId)
    console.log(`Found ${messages.length} total messages for trip ${actualTripId}`)

    if (messages.length === 0) {
      console.log(`No messages found for trip ${actualTripId}`)
      return NextResponse.json({ error: "Нет сообщений для данного рейса" }, { status: 400 })
    }

    const pendingMessages = messages.filter((msg) => msg.status === "pending" && msg.telegram_id)
    console.log(`Found ${pendingMessages.length} pending messages with telegram_id`)

    if (pendingMessages.length === 0) {
      console.log(`No pending messages with telegram_id found`)
      return NextResponse.json(
        {
          error: "Нет сообщений для отправки (все уже отправлены или нет telegram_id)",
          total: messages.length,
          pending: pendingMessages.length,
          details: messages.map((m) => ({
            id: m.id,
            phone: m.phone,
            status: m.status,
            has_telegram_id: !!m.telegram_id,
          })),
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

        // Получаем данные пользователя для имени
        const user = await getUserByPhone(phone)
        const firstName = user?.first_name || user?.name || "Водитель"

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

          // Получаем пункты для конкретного trip_identifier
          const tripPoints = await getTripPoints(actualTripId)
          const loadingPoints = tripPoints
            .filter((p) => p.point_type === "P" && p.trip_identifier === tripIdentifier)
            .sort((a, b) => a.point_num - b.point_num)
          const unloadingPoints = tripPoints
            .filter((p) => p.point_type === "D" && p.trip_identifier === tripIdentifier)
            .sort((a, b) => a.point_num - b.point_num)

          trips.push({
            trip_identifier: tripIdentifier,
            vehicle_number: firstMessage.vehicle_number || "Не указан",
            planned_loading_time: firstMessage.planned_loading_time || "Не указано",
            driver_comment: firstMessage.driver_comment || "",
            loading_points: loadingPoints.map((p) => ({
              point_id: p.point_short_id || p.point_id,
              point_name: p.point_name || `Пункт ${p.point_short_id}`,
              door_open_1: p.door_open_1,
              door_open_2: p.door_open_2,
              door_open_3: p.door_open_3,
            })),
            unloading_points: unloadingPoints.map((p) => ({
              point_id: p.point_short_id || p.point_id,
              point_name: p.point_name || `Пункт ${p.point_short_id}`,
              door_open_1: p.door_open_1,
              door_open_2: p.door_open_2,
              door_open_3: p.door_open_3,
            })),
          })
        }

        // Отправляем объединенное сообщение
        const telegramResult = await sendMultipleTripMessageWithButtons(
          phoneMessages[0].telegram_id!,
          trips,
          firstName,
          phoneMessages[0].id, // Используем ID первого сообщения для callback
        )

        console.log(`Telegram API result:`, telegramResult)

        // Обновляем статус всех сообщений для этого телефона
        for (const message of phoneMessages) {
          await updateMessageStatus(message.id, "sent")
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
          await updateMessageStatus(message.id, "error", errorMessage)
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
