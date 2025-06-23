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

    // Получаем все пункты рейса
    const tripPoints = await getTripPoints(actualTripId)
    console.log(`Found ${tripPoints.length} trip points`)

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

        console.log(`Found ${tripsByIdentifier.size} unique trip identifiers for phone ${phone}`)

        // Формируем данные для каждого рейса
        const trips = []
        for (const [tripIdentifier, tripMessages] of tripsByIdentifier) {
          const firstMessage = tripMessages[0]

          console.log(`Processing trip_identifier: ${tripIdentifier}`)

          // Получаем пункты для конкретного trip_identifier из сообщений
          // Поскольку каждое сообщение содержит информацию о пункте
          const loadingPoints = []
          const unloadingPoints = []

          // Группируем сообщения по типу пункта
          for (const msg of tripMessages) {
            // Ищем соответствующий пункт в tripPoints
            const matchingPoint = tripPoints.find(
              (p) => p.point_short_id === msg.point_id || p.point_id === msg.point_id,
            )

            const pointData = {
              point_id: msg.point_id || "unknown",
              point_name: matchingPoint?.point_name || `Пункт ${msg.point_id}`,
              door_open_1: matchingPoint?.door_open_1,
              door_open_2: matchingPoint?.door_open_2,
              door_open_3: matchingPoint?.door_open_3,
            }

            // Определяем тип пункта из данных сообщения или tripPoints
            const pointType = matchingPoint?.point_type || (msg.point_id?.startsWith("8") ? "P" : "D")

            if (pointType === "P") {
              loadingPoints.push(pointData)
            } else {
              unloadingPoints.push(pointData)
            }
          }

          console.log(
            `Trip ${tripIdentifier}: ${loadingPoints.length} loading, ${unloadingPoints.length} unloading points`,
          )

          trips.push({
            trip_identifier: tripIdentifier,
            vehicle_number: firstMessage.vehicle_number || "Не указан",
            planned_loading_time: firstMessage.planned_loading_time || "Не указано",
            driver_comment: firstMessage.driver_comment || "",
            loading_points: loadingPoints,
            unloading_points: unloadingPoints,
          })
        }

        console.log(`Prepared ${trips.length} trips for phone ${phone}`)

        // Отправляем объединенное сообщение со всеми рейсами
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
