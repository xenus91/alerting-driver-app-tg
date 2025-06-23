import { type NextRequest, NextResponse } from "next/server"
import { getTripDataForMessages } from "@/lib/database"
import { sendTelegramMessage } from "@/lib/telegram"

function formatDateTime(dateTimeString: string): string {
  try {
    const date = new Date(dateTimeString)
    const day = date.getDate()
    const month = date.toLocaleDateString("ru-RU", { month: "long" })
    const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    return `${day} ${month} ${time}`
  } catch (error) {
    return dateTimeString
  }
}

function formatDoorOpenTimes(door1?: string, door2?: string, door3?: string): string {
  const times = [door1, door2, door3].filter(Boolean)
  return times.length > 0 ? times.join(" | ") : ""
}

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()

    if (!tripId) {
      return NextResponse.json({ error: "Trip ID is required" }, { status: 400 })
    }

    console.log(`Starting to send messages for trip ${tripId}`)

    // Получаем все данные о рейсах с пунктами
    const tripData = await getTripDataForMessages(tripId)
    console.log(`Found ${tripData.length} trip data records`)

    if (tripData.length === 0) {
      return NextResponse.json({ error: "No trip data found" }, { status: 404 })
    }

    // Группируем данные по телефону
    const groupedByPhone = new Map()

    for (const record of tripData) {
      if (!record.phone) continue

      if (!groupedByPhone.has(record.phone)) {
        groupedByPhone.set(record.phone, {
          phone: record.phone,
          telegram_id: record.telegram_id,
          first_name: record.first_name,
          full_name: record.full_name,
          trips: new Map(),
        })
      }

      const phoneGroup = groupedByPhone.get(record.phone)

      if (record.trip_identifier) {
        if (!phoneGroup.trips.has(record.trip_identifier)) {
          phoneGroup.trips.set(record.trip_identifier, {
            trip_identifier: record.trip_identifier,
            vehicle_number: record.vehicle_number,
            planned_loading_time: record.planned_loading_time,
            driver_comment: record.driver_comment,
            loading_points: [],
            unloading_points: [],
          })
        }

        const trip = phoneGroup.trips.get(record.trip_identifier)

        if (record.point_id && record.point_name) {
          const pointInfo = {
            point_id: record.point_id,
            point_name: record.point_name,
            point_num: record.point_num,
            door_times: formatDoorOpenTimes(record.door_open_1, record.door_open_2, record.door_open_3),
          }

          if (record.point_type === "P") {
            trip.loading_points.push(pointInfo)
          } else if (record.point_type === "D") {
            trip.unloading_points.push(pointInfo)
          }
        }
      }
    }

    console.log(`Grouped into ${groupedByPhone.size} phone groups`)

    const results = []

    // Отправляем сообщения для каждого телефона
    for (const [phone, phoneData] of groupedByPhone) {
      try {
        if (!phoneData.telegram_id) {
          console.log(`No telegram_id for phone ${phone}, skipping`)
          continue
        }

        // Формируем сообщение
        let message = `Доброго времени суток!\n\n👤 Уважаемый, ${phoneData.first_name || phoneData.full_name || "водитель"}\n\n🚛 На Вас запланированы рейсы\n`

        const trips = Array.from(phoneData.trips.values())

        for (let i = 0; i < trips.length; i++) {
          const trip = trips[i]

          message += `${trip.trip_identifier}\n`
          message += `🚗 Транспорт: ${trip.vehicle_number || "Не указан"}\n`
          message += `⏰ Плановое время погрузки: ${formatDateTime(trip.planned_loading_time || "")}\n`

          // Пункты погрузки
          if (trip.loading_points.length > 0) {
            message += `📦 Погрузка:\n`
            trip.loading_points
              .sort((a, b) => (a.point_num || 0) - (b.point_num || 0))
              .forEach((point) => {
                message += `${point.point_num}) ${point.point_name}\n`
              })
          }

          // Пункты разгрузки
          if (trip.unloading_points.length > 0) {
            message += `\n📤 Разгрузка:\n`
            trip.unloading_points
              .sort((a, b) => (a.point_num || 0) - (b.point_num || 0))
              .forEach((point) => {
                message += `${point.point_num}) ${point.point_name}`
                if (point.door_times) {
                  message += `\n   🕐 Окна приемки: ${point.door_times}`
                }
                message += `\n`
              })
          }

          // Комментарий к рейсу
          if (trip.driver_comment) {
            message += `\n💬 Комментарий по рейсу:\n${trip.driver_comment}\n`
          }

          // Разделитель между рейсами
          if (i < trips.length - 1) {
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          }
        }

        message += `\n🙏 Просьба подтвердить рейсы`

        console.log(`Sending message to ${phone} (telegram_id: ${phoneData.telegram_id})`)
        console.log(`Message preview: ${message.substring(0, 200)}...`)

        // Отправляем сообщение в Telegram
        const success = await sendTelegramMessage(phoneData.telegram_id, message)

        results.push({
          phone: phone,
          telegram_id: phoneData.telegram_id,
          success: success,
          trips_count: trips.length,
        })

        console.log(`Message sent to ${phone}: ${success ? "SUCCESS" : "FAILED"}`)
      } catch (error) {
        console.error(`Error sending message to ${phone}:`, error)
        results.push({
          phone: phone,
          telegram_id: phoneData.telegram_id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalCount = results.length

    console.log(`Messages sent: ${successCount}/${totalCount}`)

    return NextResponse.json({
      success: true,
      sent: successCount,
      total: totalCount,
      results: results,
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
