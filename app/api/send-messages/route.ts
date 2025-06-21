import { type NextRequest, NextResponse } from "next/server"
import {
  getTrips,
  getTripMessages,
  updateMessageStatus,
  getUserByPhone,
  getTripPoints,
  updateTripMessage,
} from "@/lib/database"
import { sendTripMessageWithButtons } from "@/lib/telegram"

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

    // Показываем все сообщения для отладки
    messages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`, {
        id: msg.id,
        phone: msg.phone,
        telegram_id: msg.telegram_id,
        status: msg.status,
        trip_identifier: msg.trip_identifier,
      })
    })

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

    // Получаем пункты рейса
    const tripPoints = await getTripPoints(actualTripId)
    console.log(`Found ${tripPoints.length} trip points`)

    const loadingPoints = tripPoints.filter((p) => p.point_type === "P").sort((a, b) => a.point_num - b.point_num)
    const unloadingPoints = tripPoints.filter((p) => p.point_type === "D").sort((a, b) => a.point_num - b.point_num)

    console.log(`Loading points: ${loadingPoints.length}, Unloading points: ${unloadingPoints.length}`)

    const results = {
      total: pendingMessages.length,
      sent: 0,
      errors: 0,
      details: [] as any[],
    }

    // Отправляем сообщения с кнопками и задержкой для избежания лимитов
    for (const message of pendingMessages) {
      try {
        console.log(`=== PROCESSING MESSAGE ${message.id} ===`)
        console.log(`Phone: ${message.phone}, Telegram ID: ${message.telegram_id}`)

        // Получаем данные пользователя для имени
        const user = await getUserByPhone(message.phone)
        const firstName = user?.first_name || user?.name || "Водитель"

        console.log(`User found: ${firstName}`)

        // Отправляем красивое сообщение с данными рейса
        const telegramResult = await sendTripMessageWithButtons(
          message.telegram_id!,
          {
            trip_identifier: message.trip_identifier || "Не указан",
            vehicle_number: message.vehicle_number || "Не указан",
            planned_loading_time: message.planned_loading_time || "Не указано",
            driver_comment: message.driver_comment || "",
          },
          loadingPoints.map((p) => ({
            point_name: p.point_name || `Пункт ${p.point_short_id}`,
            door_open_1: p.door_open_1,
            door_open_2: p.door_open_2,
            door_open_3: p.door_open_3,
          })),
          unloadingPoints.map((p) => ({
            point_name: p.point_name || `Пункт ${p.point_short_id}`,
            door_open_1: p.door_open_1,
            door_open_2: p.door_open_2,
            door_open_3: p.door_open_3,
          })),
          firstName,
          message.id,
        )

        console.log(`Telegram API result:`, telegramResult)

        // Сохраняем отформатированное сообщение в базу данных
        if (telegramResult.formattedMessage) {
          await updateTripMessage(message.id, telegramResult.formattedMessage)
          console.log(`Updated message content for message ${message.id}`)
        }

        await updateMessageStatus(message.id, "sent")
        results.sent++
        results.details.push({
          phone: message.phone,
          status: "sent",
          user_name: firstName,
          telegram_message_id: telegramResult.message_id,
        })

        console.log(`Message sent successfully to ${message.phone}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
        console.error(`Error sending message to ${message.phone}:`, errorMessage)

        await updateMessageStatus(message.id, "error", errorMessage)
        results.errors++
        results.details.push({
          phone: message.phone,
          status: "error",
          error: errorMessage,
        })
      }

      // Задержка между отправками (30 сообщений в секунду - лимит Telegram)
      await new Promise((resolve) => setTimeout(resolve, 50))
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
