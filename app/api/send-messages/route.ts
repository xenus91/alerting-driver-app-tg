import { type NextRequest, NextResponse } from "next/server"
import { getTrips, getTripDataGroupedByPhone } from "@/lib/database"
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

    // Функция для форматирования даты и времени
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
        const time = date.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Moscow",
        })
        return `${day} ${month} ${time}`
      } catch (error) {
        console.error("Error formatting date:", error)
        return dateTimeString
      }
    }

    // Функция для форматирования времени работы дверей
    function formatDoorTimes(door1?: string, door2?: string, door3?: string): string {
      const times = [door1, door2, door3].filter(Boolean)
      return times.length > 0 ? times.join(" | ") : ""
    }

    // Получаем сгруппированные данные
    const groupedData = await getTripDataGroupedByPhone(actualTripId)
    console.log(`Found ${groupedData.size} phone groups`)

    if (groupedData.size === 0) {
      return NextResponse.json({ error: "Нет сообщений для отправки" }, { status: 400 })
    }

    const results = {
      total: 0,
      sent: 0,
      errors: 0,
      details: [] as any[],
    }

    // Отправляем сообщения для каждого телефона
    for (const [phone, phoneData] of groupedData) {
      try {
        console.log(`=== PROCESSING PHONE ${phone} ===`)

        const firstName = phoneData.first_name || phoneData.full_name || "Водитель"

        // Сортируем рейсы по trip_identifier
        const sortedTrips = Array.from(phoneData.trips.entries())
          .sort(([_, tripA], [__, tripB]) => {
            const timeA = new Date(tripA.planned_loading_time || "").getTime()
            const timeB = new Date(tripB.planned_loading_time || "").getTime()
            return timeA - timeB
          })
          .map(([_, trip]) => trip)

        console.log(`Found ${sortedTrips.length} trips for phone ${phone}`)

        // Формируем сообщение
        let message = `Доброго времени суток!\n\n👤 Уважаемый, ${firstName}\n\n🚛 На Вас запланированы рейсы\n`

        for (let i = 0; i < sortedTrips.length; i++) {
          const trip = sortedTrips[i]

          message += `${trip.trip_identifier}\n`
          message += `🚗 Транспорт: ${trip.vehicle_number || "Не указан"}\n`
          message += `⏰ Плановое время погрузки: ${formatDateTime(trip.planned_loading_time || "")}\n`

          // Пункты погрузки для этого конкретного рейса
          if (trip.loading_points.length > 0) {
            message += `📦 Погрузка:\n`
            trip.loading_points
              .sort((a, b) => (a.point_num || 0) - (b.point_num || 0))
              .forEach((point, index) => {
                message += `${index + 1}) ${point.point_name}\n`
              })
          }

          // Пункты разгрузки для этого конкретного рейса
          if (trip.unloading_points.length > 0) {
            message += `\n📤 Разгрузка:\n`
            trip.unloading_points
              .sort((a, b) => (a.point_num || 0) - (b.point_num || 0))
              .forEach((point, index) => {
                message += `${index + 1}) ${point.point_name}`
                const doorTimes = formatDoorTimes(point.door_open_1, point.door_open_2, point.door_open_3)
                if (doorTimes) {
                  message += `\n   🕐 Окна приемки: ${doorTimes}`
                }
                message += `\n`
              })
          }

          // Комментарий к рейсу
          if (trip.driver_comment) {
            message += `\n💬 Комментарий по рейсу:\n${trip.driver_comment}\n`
          }

          // Разделитель между рейсами
          if (i < sortedTrips.length - 1) {
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          }
        }

        message += `\n🙏 Просьба подтвердить рейсы`

        console.log(`Sending message to ${phone}`)
        console.log(`Message preview: ${message.substring(0, 300)}...`)

        // Отправляем сообщение в Telegram
        const telegramResult = await sendMultipleTripMessageWithButtons(
          phoneData.telegram_id,
          sortedTrips,
          firstName,
          1, // Временный ID для callback
        )

        console.log(`Telegram API result:`, telegramResult)

        // Обновляем статус сообщений (нужно получить ID сообщений для этого телефона)
        // Это требует дополнительного запроса к базе данных

        results.sent++
        results.details.push({
          phone: phone,
          status: "sent",
          user_name: firstName,
          trips_count: sortedTrips.length,
          telegram_message_id: telegramResult.message_id,
        })

        console.log(`Messages sent successfully to ${phone}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
        console.error(`Error sending messages to ${phone}:`, errorMessage)

        results.errors++
        results.details.push({
          phone: phone,
          status: "error",
          error: errorMessage,
        })
      }

      // Задержка между отправками
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    results.total = results.sent + results.errors

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
