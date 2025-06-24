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

    // Функция для форматирования даты и времени БЕЗ смещения часового пояса
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

        // Убираем timeZone: "Europe/Moscow" чтобы не было смещения
        const hours = date.getHours().toString().padStart(2, "0")
        const minutes = date.getMinutes().toString().padStart(2, "0")
        const time = `${hours}:${minutes}`

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
        console.log(
          `DEBUG: Phone data:`,
          JSON.stringify(
            {
              phone: phoneData.phone,
              telegram_id: phoneData.telegram_id,
              first_name: phoneData.first_name,
              trips_count: phoneData.trips.size,
            },
            null,
            2,
          ),
        )

        const firstName = phoneData.first_name || phoneData.full_name || "Водитель"

        // Сортируем рейсы по времени погрузки (по возрастанию)
        const sortedTrips = Array.from(phoneData.trips.entries())
          .sort(([_, tripA], [__, tripB]) => {
            const timeA = new Date(tripA.planned_loading_time || "").getTime()
            const timeB = new Date(tripB.planned_loading_time || "").getTime()
            return timeA - timeB
          })
          .map(([_, trip]) => trip)

        console.log(`DEBUG: Sorted trips for ${phone}:`)
        sortedTrips.forEach((trip, index) => {
          console.log(`  ${index + 1}. Trip: ${trip.trip_identifier}`)
          console.log(`     Loading points: ${trip.loading_points.length}`)
          trip.loading_points.forEach((point, i) => {
            console.log(`       ${i + 1}. ${point.point_name}`)
          })
          console.log(`     Unloading points: ${trip.unloading_points.length}`)
          trip.unloading_points.forEach((point, i) => {
            console.log(`       ${i + 1}. ${point.point_name}`)
          })
        })

        console.log(`Found ${sortedTrips.length} trips for phone ${phone}`)

        // Отправляем сообщение в Telegram
        const telegramResult = await sendMultipleTripMessageWithButtons(
          phoneData.telegram_id,
          sortedTrips,
          firstName,
          1, // Временный ID для callback
        )

        console.log(`Telegram API result:`, telegramResult)

        // ВАЖНО: Обновляем статус ВСЕХ сообщений для этого телефона на "sent"
        const { neon } = await import("@neondatabase/serverless")
        const sql = neon(process.env.DATABASE_URL!)

        await sql`
          UPDATE trip_messages 
          SET status = 'sent', 
              sent_at = ${new Date().toISOString()}
          WHERE trip_id = ${actualTripId} AND phone = ${phone}
        `

        console.log(`Updated message status to 'sent' for phone ${phone}`)

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

        // Обновляем статус на "error" при ошибке
        try {
          const { neon } = await import("@neondatabase/serverless")
          const sql = neon(process.env.DATABASE_URL!)

          await sql`
            UPDATE trip_messages 
            SET status = 'error', 
                error_message = ${errorMessage}
            WHERE trip_id = ${actualTripId} AND phone = ${phone}
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
