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

    // Группируем рейсы по телефонам
    const phoneGroups = new Map<string, any[]>()

    for (const tripDataItem of tripData) {
      const phone = tripDataItem.phone
      if (!phoneGroups.has(phone)) {
        phoneGroups.set(phone, [])
      }
      phoneGroups.get(phone)!.push(tripDataItem)
    }

    console.log(`Grouped trips into ${phoneGroups.size} phone groups`)

    const results = {
      total: 0,
      sent: 0,
      errors: 0,
      details: [] as any[],
    }

    // Обрабатываем каждую группу телефонов
    for (const [phone, phoneTrips] of phoneGroups) {
      try {
        results.total++

        console.log(`Processing ${phoneTrips.length} trips for phone: ${phone}`)

        // Ищем пользователя по номеру телефона
        const user = await getUserByPhone(phone)
        if (!user) {
          console.log(`User not found for phone: ${phone}`)
          results.errors++
          results.details.push({
            phone: phone,
            status: "error",
            error: "Пользователь не найден",
          })
          continue
        }

        // Проверяем верификацию пользователя
        if (user.verified === false) {
          console.log(`User not verified for phone: ${phone}`)
          results.errors++
          results.details.push({
            phone: phone,
            status: "error",
            error: "Пользователь не верифицирован",
          })
          continue
        }

        console.log(`Processing trips for user: ${user.first_name || user.name}`)

        // Создаем записи в БД для всех рейсов этого пользователя
        for (const tripDataItem of phoneTrips) {
          // Проверяем и создаем пункты для этого рейса
          const loadingPoints = tripDataItem.loading_points || []
          const unloadingPoints = tripDataItem.unloading_points || []

          console.log(
            `Trip ${tripDataItem.trip_identifier}: ${loadingPoints.length} loading points, ${unloadingPoints.length} unloading points`,
          )

          // Создаем пункты погрузки
          for (const loadingPoint of loadingPoints) {
            if (!loadingPoint || !loadingPoint.point_id) {
              console.warn(`Invalid loading point:`, loadingPoint)
              continue
            }

            const point = pointsMap.get(loadingPoint.point_id)
            if (!point) {
              console.warn(`Point not found: ${loadingPoint.point_id}`)
              continue
            }

            await createTripPoint(
              mainTrip.id,
              loadingPoint.point_id,
              "P",
              loadingPoint.point_num || 1,
              tripDataItem.trip_identifier,
            )
            console.log(`Created loading point: ${loadingPoint.point_id}`)
          }

          // Создаем пункты разгрузки
          for (const unloadingPoint of unloadingPoints) {
            if (!unloadingPoint || !unloadingPoint.point_id) {
              console.warn(`Invalid unloading point:`, unloadingPoint)
              continue
            }

            const point = pointsMap.get(unloadingPoint.point_id)
            if (!point) {
              console.warn(`Point not found: ${unloadingPoint.point_id}`)
              continue
            }

            await createTripPoint(
              mainTrip.id,
              unloadingPoint.point_id,
              "D",
              unloadingPoint.point_num || 1,
              tripDataItem.trip_identifier,
            )
            console.log(`Created unloading point: ${unloadingPoint.point_id}`)
          }

          // Создаем сообщение для этого рейса
          await createTripMessage(
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
        }

        // Теперь отправляем ОДНО сообщение со всеми рейсами для этого пользователя
        try {
          // Подготавливаем данные для отправки
          const tripsForSending = phoneTrips.map((tripDataItem) => {
            const loadingPointsData = []
            const unloadingPointsData = []

            const loadingPoints = tripDataItem.loading_points || []
            const unloadingPoints = tripDataItem.unloading_points || []

            for (const loadingPoint of loadingPoints) {
              if (!loadingPoint || !loadingPoint.point_id) continue

              const point = pointsMap.get(loadingPoint.point_id)
              if (point) {
                console.log(`DEBUG: Loading point ${point.point_id} coordinates:`, {
                  latitude: point.latitude,
                  longitude: point.longitude,
                  latitude_type: typeof point.latitude,
                  longitude_type: typeof point.longitude,
                })

                loadingPointsData.push({
                  point_id: point.point_id,
                  point_name: point.point_name,
                  point_num: loadingPoint.point_num || 1,
                  door_open_1: point.door_open_1,
                  door_open_2: point.door_open_2,
                  door_open_3: point.door_open_3,
                  latitude: point.latitude,
                  longitude: point.longitude,
                })
              }
            }

            for (const unloadingPoint of unloadingPoints) {
              if (!unloadingPoint || !unloadingPoint.point_id) continue

              const point = pointsMap.get(unloadingPoint.point_id)
              if (point) {
                console.log(`DEBUG: Unloading point ${point.point_id} coordinates:`, {
                  latitude: point.latitude,
                  longitude: point.longitude,
                  latitude_type: typeof point.latitude,
                  longitude_type: typeof point.longitude,
                })

                unloadingPointsData.push({
                  point_id: point.point_id,
                  point_name: point.point_name,
                  point_num: unloadingPoint.point_num || 1,
                  door_open_1: point.door_open_1,
                  door_open_2: point.door_open_2,
                  door_open_3: point.door_open_3,
                  latitude: point.latitude,
                  longitude: point.longitude,
                })
              }
            }

            return {
              trip_identifier: tripDataItem.trip_identifier,
              vehicle_number: tripDataItem.vehicle_number,
              planned_loading_time: tripDataItem.planned_loading_time,
              driver_comment: tripDataItem.driver_comment,
              loading_points: loadingPointsData,
              unloading_points: unloadingPointsData,
            }
          })

          const firstName = user.first_name || user.full_name || "Водитель"

          // Отправляем ОДНО сообщение со всеми рейсами
          const telegramResult = await sendMultipleTripMessageWithButtons(
            user.telegram_id,
            tripsForSending,
            firstName,
            mainTrip.id, // Используем ID основного trip как messageId
          )

          console.log(`Telegram API result:`, telegramResult)

          // Обновляем статус ВСЕХ сообщений для этого пользователя на "sent"
          const { neon } = await import("@neondatabase/serverless")
          const sql = neon(process.env.DATABASE_URL!)

          await sql`
          UPDATE trip_messages 
          SET status = 'sent', 
              sent_at = ${new Date().toISOString()}
          WHERE trip_id = ${mainTrip.id} AND phone = ${phone}
        `

          console.log(`Updated message status to 'sent' for phone: ${phone}`)

          results.sent++
          results.details.push({
            phone: phone,
            status: "sent",
            user_name: firstName,
            trips_count: phoneTrips.length,
            telegram_message_id: telegramResult.message_id,
          })

          console.log(`Messages sent successfully to ${phone}`)
        } catch (sendError) {
          const errorMessage = sendError instanceof Error ? sendError.message : "Ошибка отправки"
          console.error(`Failed to send message to ${phone}:`, sendError)

          // Обновляем статус на "error" при ошибке
          try {
            const { neon } = await import("@neondatabase/serverless")
            const sql = neon(process.env.DATABASE_URL!)

            await sql`
            UPDATE trip_messages 
            SET status = 'error', 
                error_message = ${errorMessage}
            WHERE trip_id = ${mainTrip.id} AND phone = ${phone}
          `
          } catch (updateError) {
            console.error("Error updating message status to error:", updateError)
          }

          results.errors++
          results.details.push({
            phone: phone,
            status: "error",
            error: errorMessage,
          })
        }
      } catch (error) {
        console.error(`Error processing trips for phone ${phone}:`, error)
        results.errors++
        results.details.push({
          phone: phone,
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
