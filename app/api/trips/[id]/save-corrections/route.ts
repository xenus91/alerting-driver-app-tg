import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, corrections, deletedTrips = [] } = await request.json()

  try {
    console.log(`Saving corrections for trip ${tripId}, phone ${phone}`)
    console.log("Corrections data:", corrections)
    console.log("Deleted trips:", deletedTrips)

    // Начинаем транзакцию
    await sql`BEGIN`

    // Получаем информацию о пользователе
    const userResult = await sql`
      SELECT telegram_id, first_name, full_name
      FROM users
      WHERE phone = ${phone}
      LIMIT 1
    `
    if (userResult.length === 0) {
      throw new Error(`Пользователь с номером телефона ${phone} не найден`)
    }
    const user = userResult[0]
    const firstName = user.first_name || user.full_name || "Водитель"

    // Сначала удаляем рейсы, которые были помечены для удаления
    if (deletedTrips.length > 0) {
      console.log(`Deleting trips: ${deletedTrips.join(", ")} for phone ${phone}`)

      for (const tripIdentifier of deletedTrips) {
        // Удаляем из trip_messages
        await sql`
          DELETE FROM trip_messages 
          WHERE trip_id = ${tripId} 
            AND phone = ${phone} 
            AND trip_identifier = ${tripIdentifier}
        `

        // Удаляем из trip_points
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND trip_identifier = ${tripIdentifier}
        `

        console.log(`Deleted trip ${tripIdentifier} for phone ${phone}`)
      }
    }

    try {
      // Группируем корректировки по original_trip outubro для обновления
      const originalTripGroups = new Map()

      for (const correction of corrections) {
        const originalKey = correction.original_trip_identifier || correction.trip_identifier
        if (!originalTripGroups.has(originalKey)) {
          originalTripGroups.set(originalKey, {
            original_trip_identifier: originalKey,
            new_trip_identifier: correction.trip_identifier,
            vehicle_number: correction.vehicle_number,
            planned_loading_time: correction.planned_loading_time,
            driver_comment: correction.driver_comment,
            points: [],
            is_new_trip: !correction.original_trip_identifier, // Новый рейс если нет original
          })
        }

        if (correction.point_id) {
          originalTripGroups.get(originalKey).points.push({
            point_type: correction.point_type,
            point_num: correction.point_num,
            point_id: correction.point_id,
          })
        }
      }

      // Подготавливаем данные для формирования текста сообщения
      const tripsForMessage = []

      // Обрабатываем каждый рейс
      for (const [originalTripIdentifier, tripData] of originalTripGroups) {
        if (tripData.is_new_trip) {
          console.log(`Creating new trip message for trip: ${tripData.new_trip_identifier}`)

          // Создаем новое сообщение для нового рейса со статусом 'sent'
          await sql`
            INSERT INTO trip_messages (
              trip_id, phone, message, telegram_id, status, response_status,
              trip_identifier, vehicle_number, planned_loading_time, driver_comment,
              sent_at
            )
            SELECT 
              ${tripId}, 
              ${phone}, 
              'Новый рейс (добавлен при корректировке)', 
              telegram_id, 
              'sent',
              'pending',
              ${tripData.new_trip_identifier},
              ${tripData.vehicle_number},
              ${tripData.planned_loading_time},
              ${tripData.driver_comment || null},
              CURRENT_TIMESTAMP
            FROM users 
            WHERE phone = ${phone}
            LIMIT 1
          `

          console.log(`Created new trip message for ${tripData.new_trip_identifier}`)
        } else {
          // Обновляем существующее сообщение и сбрасываем статус подтверждения
          await sql`
            UPDATE trip_messages 
            SET trip_identifier = ${tripData.new_trip_identifier},
                vehicle_number = ${tripData.vehicle_number},
                planned_loading_time = ${tripData.planned_loading_time},
                driver_comment = ${tripData.driver_comment || null},
                response_status = 'pending',
                response_comment = NULL,
                response_at = NULL
            WHERE trip_id = ${tripId} 
              AND metformin = ${phone} 
              AND trip_identifier = ${originalTripIdentifier}
          `

          console.log(`Updated existing trip message for ${originalTripIdentifier} -> ${tripData.new_trip_identifier}`)
        }

        // Удаляем старые точки для этого рейса
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND trip_identifier = ${originalTripIdentifier}
        `

        // Собираем данные для сообщения
        const loading_points = []
        const unloading_points = []

        // Добавляем новые точки с новым trip_identifier
        for (const point of tripData.points) {
          const pointResult = await sql`
            SELECT id, point_id, point_name, door_open_1, door_open_2, door_open_3, latitude, longitude
            FROM points 
            WHERE point_id = ${point.point_id}
          `

          if (pointResult.length > 0) {
            await sql`
              INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier)
              VALUES (${tripId}, ${pointResult[0].id}, ${point.point_type}, ${point.point_num}, ${tripData.new_trip_identifier})
            `

            console.log(`Added point ${point.point_id} to trip ${tripData.new_trip_identifier}`)

            const pointInfo = {
              point_id: pointResult[0].point_id,
              point_name: pointResult[0].point_name,
              point_num: point.point_num,
              door_open_1: pointResult[0].door_open_1,
              door_open_2: pointResult[0].door_open_2,
              door_open_3: pointResult[0].door_open_3,
              latitude: pointResult[0].latitude,
              longitude: pointResult[0].longitude,
            }

            if (point.point_type === "P") {
              loading_points.push(pointInfo)
            } else if (point.point_type === "D") {
              unloading_points.push(pointInfo)
            }
          }
        }

        tripsForMessage.push({
          trip_identifier: tripData.new_trip_identifier,
          vehicle_number: tripData.vehicle_number,
          planned_loading_time: tripData.planned_loading_time,
          driver_comment: tripData.driver_comment,
          loading_points,
          unloading_points,
        })
      }

      // Генерируем текст сообщения для всех рейсов
      let message = `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
      message += `🌅 <b>Доброго времени суток!</b>\n\n`
      message += `👤 Уважаемый, <b>${firstName}</b>\n\n`

      const isMultiple = tripsForMessage.length > 1
      message += `🚛 На Вас запланирован${isMultiple ? "ы" : ""} <b>${tripsForMessage.length} рейс${tripsForMessage.length > 1 ? "а" : ""}:</b>\n\n`

      const sortedTrips = [...tripsForMessage].sort((a, b) => {
        const timeA = new Date(a.planned_loading_time || "").getTime()
        const timeB = new Date(b.planned_loading_time || "").getTime()
        return timeA - timeB
      })

      sortedTrips.forEach((trip, tripIndex) => {
        console.log(`Processing trip ${tripIndex + 1}: ${trip.trip_identifier}`)

        message += `<b>Рейс ${tripIndex + 1}:</b>\n`
        message += `Транспортировка: <b>${trip.trip_identifier}</b>\n`
        message += `🚗 Транспорт: <b>${trip.vehicle_number}</b>\n`

        const formatDateTime = (dateTimeString: string): string => {
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

            return `${day} ${month} ${time}`
          } catch (error) {
            console.error("Error formatting date:", error)
            return dateTimeString
          }
        }

        message += `⏰ Плановое время погрузки: <b>${formatDateTime(trip.planned_loading_time)}</b>\n\n`

        if (trip.loading_points.length > 0) {
          message += `📦 <b>Погрузка:</b>\n`
          trip.loading_points.forEach((point, index) => {
            message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>\n`
          })
          message += `\n`
        }

        if (trip.unloading_points.length > 0) {
          message += `📤 <b>Разгрузка:</b>\n`
          trip.unloading_points.forEach((point, index) => {
            message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>\n`

            const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
            if (windows.length > 0) {
              message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>\n`
            }
          })
          message += `\n`
        }

        if (trip.driver_comment && trip.driver_comment.trim()) {
          message += `💬 <b>Комментарий по рейсу:</b>\n<i>${trip.driver_comment}</i>\n\n`
        }

        const routePoints = [...trip.loading_points, ...trip.unloading_points]
        console.log(
          `Route points for trip ${trip.trip_identifier}:`,
          routePoints.map((p) => ({ id: p.point_id, lat: p.latitude, lng: p.longitude })),
        )

        const validPoints = routePoints.filter((p) => {
          const lat = typeof p.latitude === "string" ? Number.parseFloat(p.latitude) : p.latitude
          const lng = typeof p.longitude === "string" ? Number.parseFloat(p.longitude) : p.longitude
          return lat && lng && !isNaN(lat) && !isNaN(lng)
        })

        let routeUrl = null
        if (validPoints.length >= 2) {
          const coordinates = validPoints
            .map((p) => {
              const lat = typeof p.latitude === "string" ? Number.parseFloat(p.latitude) : p.latitude
              const lng = typeof p.longitude === "string" ? Number.parseFloat(p.longitude) : p.longitude
              return `${lat},${lng}`
            })
            .join("~")

          routeUrl = `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`
          console.log(`Built route URL: ${routeUrl}`)
        } else {
          console.log(`No route URL generated for trip ${trip.trip_identifier} - insufficient coordinates`)
        }

        if (routeUrl) {
          message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>\n\n`
          console.log(`Added route URL for trip ${trip.trip_identifier}`)
        }

        if (tripIndex < sortedTrips.length - 1) {
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
        }
      })

      message += `🙏 <b>Просьба подтвердить рейс${isMultiple ? "ы" : ""}</b>`

      console.log(`Final message length: ${message.length}`)
      console.log(`Message preview: ${message.substring(0, 200)}...`)

      // Обновляем поле message для всех записей с данным trip_id и phone
      await sql`
        UPDATE trip_messages 
        SET message = ${message}
        WHERE trip_id = ${tripId} AND phone = ${phone}
      `
      console.log(`Updated message field for trip_id ${tripId} and phone ${phone}`)

      await sql`COMMIT`

      console.log(
        `Corrections saved successfully for ${originalTripGroups.size} trips, deleted ${deletedTrips.length} trips`,
      )

      return NextResponse.json({
        success: true,
        message: "Corrections saved successfully",
        updatedTrips: originalTripGroups.size,
        deletedTrips: deletedTrips.length,
      })
    } catch (error) {
      await sql`ROLLBACK`
      throw error
    }
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
