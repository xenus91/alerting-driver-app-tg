import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  createTrip,
  createTripMessage,
  createTripPoint,
  getUserByPhone,
  getAllPoints,
  type Point,
} from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Получаем информацию о текущем пользователе
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get("session_token")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Получаем данные текущего пользователя из сессии
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const currentUserResult = await sql`
      SELECT u.id, u.telegram_id, u.phone, u.name, u.first_name, u.last_name, u.full_name, u.carpark, u.role
      FROM users u
      JOIN user_sessions us ON u.id = us.user_id
      WHERE us.session_token = ${sessionCookie.value} AND us.expires_at > NOW()
      LIMIT 1
    `

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: "Сессия не найдена или истекла" }, { status: 401 })
    }

    const currentUser = currentUserResult[0]
    console.log(`=== SEND MESSAGES API CALLED BY USER ===`)
    console.log(`Current user:`, {
      id: currentUser.id,
      name: currentUser.first_name || currentUser.name,
      carpark: currentUser.carpark,
      role: currentUser.role,
    })

    const body = await request.json()
    console.log(`Received body:`, JSON.stringify(body, null, 2))

    // Поддерживаем оба формата: новый (tripData) и старый (campaignId как массив)
    const tripData = body.tripData || body.campaignId

    if (!tripData || !Array.isArray(tripData) || tripData.length === 0) {
      console.error("No trip data found in request")
      return NextResponse.json({ error: "Данные рейсов не найдены" }, { status: 400 })
    }

    console.log(`Processing ${tripData.length} trips for sending`)

    // Создаем основной trip ТОЛЬКО при отправке с carpark текущего пользователя
    const mainTrip = await createTrip(currentUser.carpark)
    console.log(`Created main trip with ID: ${mainTrip.id} and carpark: ${currentUser.carpark}`)

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

            for (const loadingPoint of tripDataItem.loading_points || []) {
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
                  point_num: loadingPoint.point_num,
                  door_open_1: point.door_open_1,
                  door_open_2: point.door_open_2,
                  door_open_3: point.door_open_3,
                  latitude: point.latitude,
                  longitude: point.longitude,
                })
              }
            }

            for (const unloadingPoint of tripDataItem.unloading_points || []) {
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
                  point_num: unloadingPoint.point_num,
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
    console.log(`Trip created with carpark: ${currentUser.carpark}`)

    return NextResponse.json({
      success: true,
      tripId: mainTrip.id,
      carpark: currentUser.carpark,
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
