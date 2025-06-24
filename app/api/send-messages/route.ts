import { type NextRequest, NextResponse } from "next/server"
import {
  createTrip,
  createTripMessage,
  createTripPoint,
  getUserByPhone,
  getAllPoints,
  type Point,
} from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log(`=== SEND MESSAGES API CALLED ===`)
    console.log(`Received body:`, JSON.stringify(body, null, 2))

    // Поддерживаем оба формата: новый (tripData) и старый (campaignId как массив)
    const tripData = body.tripData || body.campaignId

    if (!tripData || !Array.isArray(tripData) || tripData.length === 0) {
      console.error("No trip data found in request")
      return NextResponse.json({ error: "Данные рейсов не найдены" }, { status: 400 })
    }

    console.log(`Processing ${tripData.length} trips for sending`)

    // Создаем основной trip ТОЛЬКО при отправке
    const mainTrip = await createTrip()
    console.log(`Created main trip with ID: ${mainTrip.id}`)

    // Получаем все доступные пункты из базы данных
    const allPoints = await getAllPoints()
    console.log(`Found ${allPoints.length} points in database`)

    // Создаем карту пунктов для быстрого поиска
    const pointsMap = new Map<string, Point>()
    for (const point of allPoints) {
      pointsMap.set(point.point_id, point)
    }

    const results = {
      total: 0,
      sent: 0,
      errors: 0,
      details: [] as any[],
    }

    // Обрабатываем каждый рейс
    for (const tripDataItem of tripData) {
      try {
        results.total++

        console.log(`Processing trip for phone: ${tripDataItem.phone}`)

        // Ищем пользователя по номеру телефона
        const user = await getUserByPhone(tripDataItem.phone)
        if (!user) {
          console.log(`User not found for phone: ${tripDataItem.phone}`)
          results.errors++
          results.details.push({
            phone: tripDataItem.phone,
            status: "error",
            error: "Пользователь не найден",
          })
          continue
        }

        // Проверяем верификацию пользователя
        if (user.verified === false) {
          console.log(`User not verified for phone: ${tripDataItem.phone}`)
          results.errors++
          results.details.push({
            phone: tripDataItem.phone,
            status: "error",
            error: "Пользователь не верифицирован",
          })
          continue
        }

        console.log(`Processing trip for user: ${user.first_name || user.name}`)

        // Создаем пункты для этого рейса
        for (const loadingPoint of tripDataItem.loading_points || []) {
          const point = pointsMap.get(loadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${loadingPoint.point_id}`)
            continue
          }

          await createTripPoint(
            mainTrip.id,
            loadingPoint.point_id,
            "P",
            loadingPoint.point_num,
            tripDataItem.trip_identifier,
          )
          console.log(`Created loading point: ${loadingPoint.point_id}`)
        }

        for (const unloadingPoint of tripDataItem.unloading_points || []) {
          const point = pointsMap.get(unloadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${unloadingPoint.point_id}`)
            continue
          }

          await createTripPoint(
            mainTrip.id,
            unloadingPoint.point_id,
            "D",
            unloadingPoint.point_num,
            tripDataItem.trip_identifier,
          )
          console.log(`Created unloading point: ${unloadingPoint.point_id}`)
        }

        // Создаем сообщение для этого рейса
        const message = await createTripMessage(
          mainTrip.id,
          tripDataItem.phone,
          "Автоматически сгенерированное сообщение о рейсе",
          user.telegram_id,
          {
            trip_identifier: tripDataItem.trip_identifier,
            vehicle_number: tripDataItem.vehicle_number,
            planned_loading_time: tripDataItem.planned_loading_time,
            driver_comment: tripDataItem.driver_comment,
          },
        )

        console.log(`Created trip message with ID: ${message.id}`)

        // Теперь отправляем сообщение через Telegram
        try {
          // Функция для форматирования времени БЕЗ смещения часового пояса
          function formatDateTime(dateTimeString: string): string {
            try {
              if (!dateTimeString) return "Не указано"

              const date = new Date(dateTimeString)
              if (isNaN(date.getTime())) return dateTimeString

              const day = date.getDate()
              const monthNames = [
                "января",
                "февраля",
                "марта",
                "апреля",
                "мая",
                "июня",
                "июля",
                "августа",
                "сентября",
                "октября",
                "ноября",
                "декабря",
              ]
              const month = monthNames[date.getMonth()]

              const hours = date.getHours().toString().padStart(2, "0")
              const minutes = date.getMinutes().toString().padStart(2, "0")
              const time = `${hours}:${minutes}`

              return `${day} ${month}, ${time}`
            } catch (error) {
              console.error("Error formatting date:", error)
              return dateTimeString
            }
          }

          // Получаем данные о пунктах для этого рейса
          const loadingPointsData = []
          const unloadingPointsData = []

          for (const loadingPoint of tripDataItem.loading_points || []) {
            const point = pointsMap.get(loadingPoint.point_id)
            if (point) {
              loadingPointsData.push({
                point_id: point.point_id,
                point_name: point.point_name,
                point_num: loadingPoint.point_num,
                door_open_1: point.door_open_1,
                door_open_2: point.door_open_2,
                door_open_3: point.door_open_3,
              })
            }
          }

          for (const unloadingPoint of tripDataItem.unloading_points || []) {
            const point = pointsMap.get(unloadingPoint.point_id)
            if (point) {
              unloadingPointsData.push({
                point_id: point.point_id,
                point_name: point.point_name,
                point_num: unloadingPoint.point_num,
                door_open_1: point.door_open_1,
                door_open_2: point.door_open_2,
                door_open_3: point.door_open_3,
              })
            }
          }

          // Формируем данные для отправки
          const tripForSending = {
            trip_identifier: tripDataItem.trip_identifier,
            vehicle_number: tripDataItem.vehicle_number,
            planned_loading_time: tripDataItem.planned_loading_time,
            driver_comment: tripDataItem.driver_comment,
            loading_points: loadingPointsData,
            unloading_points: unloadingPointsData,
          }

          const firstName = user.first_name || user.full_name || "Водитель"

          // Отправляем сообщение в Telegram
          const telegramResult = await sendMultipleTripMessageWithButtons(
            user.telegram_id,
            [tripForSending],
            firstName,
            message.id,
          )

          console.log(`Telegram API result:`, telegramResult)

          // Обновляем статус сообщения на "sent"
          const { neon } = await import("@neondatabase/serverless")
          const sql = neon(process.env.DATABASE_URL!)

          await sql`
            UPDATE trip_messages 
            SET status = 'sent', 
                sent_at = ${new Date().toISOString()}
            WHERE id = ${message.id}
          `

          console.log(`Updated message status to 'sent' for message ID: ${message.id}`)

          results.sent++
          results.details.push({
            phone: tripDataItem.phone,
            status: "sent",
            user_name: firstName,
            telegram_message_id: telegramResult.message_id,
          })

          console.log(`Message sent successfully to ${tripDataItem.phone}`)
        } catch (sendError) {
          const errorMessage = sendError instanceof Error ? sendError.message : "Ошибка отправки"
          console.error(`Failed to send message to ${tripDataItem.phone}:`, sendError)

          // Обновляем статус на "error" при ошибке
          try {
            const { neon } = await import("@neondatabase/serverless")
            const sql = neon(process.env.DATABASE_URL!)

            await sql`
              UPDATE trip_messages 
              SET status = 'error', 
                  error_message = ${errorMessage}
              WHERE id = ${message.id}
            `
          } catch (updateError) {
            console.error("Error updating message status to error:", updateError)
          }

          results.errors++
          results.details.push({
            phone: tripDataItem.phone,
            status: "error",
            error: errorMessage,
          })
        }
      } catch (error) {
        console.error(`Error processing trip for phone ${tripDataItem.phone}:`, error)
        results.errors++
        results.details.push({
          phone: tripDataItem.phone,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }

      // Задержка между отправками
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(`=== MESSAGE SENDING COMPLETE ===`)
    console.log(`Total: ${results.total}, Sent: ${results.sent}, Errors: ${results.errors}`)

    return NextResponse.json({
      success: true,
      tripId: mainTrip.id,
      results,
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
