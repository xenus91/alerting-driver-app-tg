import { type NextRequest, NextResponse } from "next/server"
import {
  createTrip,
  createTripMessage,
  createTripPoint,
  getUserByPhone,
  getAllPoints,
  type Point,
} from "@/lib/database"
import { sendTelegramMessage } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const { tripData } = await request.json()

    if (!tripData || !Array.isArray(tripData)) {
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

    // Обрабатываем каждый сгруппированный рейс
    for (const tripDataItem of tripData) {
      try {
        results.total++

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
        if (!user.verified) {
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
        for (const loadingPoint of tripDataItem.loading_points) {
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
        }

        for (const unloadingPoint of tripDataItem.unloading_points) {
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

        // Отправляем сообщение
        try {
          await sendTelegramMessage(user.telegram_id, message.id)
          results.sent++
          results.details.push({
            phone: tripDataItem.phone,
            status: "sent",
          })
          console.log(`Message sent to user: ${user.first_name || user.name} (${tripDataItem.phone})`)
        } catch (sendError) {
          results.errors++
          results.details.push({
            phone: tripDataItem.phone,
            status: "error",
            error: sendError instanceof Error ? sendError.message : "Ошибка отправки",
          })
          console.error(`Failed to send message to ${tripDataItem.phone}:`, sendError)
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
    }

    console.log(`Sending complete. Total: ${results.total}, Sent: ${results.sent}, Errors: ${results.errors}`)

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
