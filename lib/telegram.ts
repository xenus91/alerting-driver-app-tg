import { buildRouteUrl } from "./utils"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

interface Point {
  point_id: string
  point_name: string
  adress?: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: string
  longitude?: string
  point_num?: number
}

interface Trip {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  loading_points: Point[]
  unloading_points: Point[]
}

export async function sendMultipleTripMessageWithButtons(
  telegramId: number,
  trips: Trip[],
  driverName: string,
  messageId: number,
  isCorrection = false,
  isResend = false,
  previousTelegramMessageId?: number | null,
): Promise<{ message_id: number; messageText: string }> {
  try {
    console.log(`=== SENDING MESSAGE ===`)
    console.log(`Telegram ID: ${telegramId}`)
    console.log(`Trips count: ${trips.length}`)
    console.log(`Is Correction: ${isCorrection}`)
    console.log(`Is Resend: ${isResend}`)
    console.log(`Previous Message ID: ${previousTelegramMessageId}`)

    // Удаляем предыдущее сообщение если есть
    if (previousTelegramMessageId) {
      try {
        await fetch(`${TELEGRAM_API_URL}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            message_id: previousTelegramMessageId,
          }),
        })
        console.log(`Deleted previous message: ${previousTelegramMessageId}`)
      } catch (error) {
        console.log(`Could not delete previous message: ${error}`)
      }
    }

    // Сортируем рейсы по времени погрузки
    const sortedTrips = trips.sort(
      (a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime(),
    )

    let message = `👋 Привет, ${driverName}!\n\n`

    // Добавляем заголовок в зависимости от типа сообщения
    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
    } else if (isResend) {
      message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
    }

    // Перебираем все рейсы
    sortedTrips.forEach((trip, tripIndex) => {
      const tripNumber = tripIndex + 1
      message += `<b>Рейс ${tripNumber}:</b>\n`
      message += `🚛 Транспортировка: ${trip.trip_identifier}\n`
      message += `🚗 Транспорт: ${trip.vehicle_number}\n`

      // Форматируем дату и время
      const loadingTime = new Date(trip.planned_loading_time)
      const formattedDate = loadingTime.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      })
      const formattedTime = loadingTime.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
      message += `⏰ Плановое время погрузки: ${formattedDate} ${formattedTime}\n`

      if (trip.driver_comment) {
        message += `💬 Комментарий: ${trip.driver_comment}\n`
      }

      message += `\n📍 <b>Маршрут:</b>\n`

      // Объединяем все точки и сортируем по point_num
      const allPoints: (Point & { type: "loading" | "unloading" })[] = [
        ...trip.loading_points.map((p) => ({ ...p, type: "loading" as const })),
        ...trip.unloading_points.map((p) => ({ ...p, type: "unloading" as const })),
      ]

      // Сортируем по point_num
      allPoints.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Выводим точки в едином списке
      allPoints.forEach((point, index) => {
        const pointNumber = index + 1
        const typeText = point.type === "loading" ? "Погрузка" : "Разгрузка"
        const typeIcon = point.type === "loading" ? "📦" : "📤"

        message += `${pointNumber}) ${typeIcon} ${point.point_id} ${point.point_name} (${typeText})\n`

        if (point.adress) {
          message += `    ${point.adress}\n`
        }

        // Добавляем информацию об окнах приемки для точек разгрузки
        if (point.type === "unloading") {
          const windows = []
          if (point.door_open_1) windows.push(point.door_open_1)
          if (point.door_open_2) windows.push(point.door_open_2)
          if (point.door_open_3) windows.push(point.door_open_3)

          if (windows.length > 0) {
            message += `    Окна приемки: ${windows.join(" | ")}\n`
          }
        }
      })

      // Проверяем, есть ли координаты у всех точек для построения маршрута
      const allPointsHaveCoordinates = allPoints.every(
        (point) => point.latitude && point.longitude && point.latitude.trim() !== "" && point.longitude.trim() !== "",
      )

      if (allPointsHaveCoordinates && allPoints.length > 0) {
        const routeUrl = buildRouteUrl(
          allPoints.map((p) => ({
            latitude: p.latitude!,
            longitude: p.longitude!,
            name: p.point_name,
          })),
        )
        message += `\n🗺️ <a href="${routeUrl}">Построить маршрут</a>\n`
      }

      message += `\n`
    })

    // Создаем кнопки
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Принять", callback_data: `confirm_${messageId}` },
          { text: "❌ Отклонить", callback_data: `reject_${messageId}` },
        ],
        [{ text: "🚫 Отказаться", callback_data: `decline_${messageId}` }],
      ],
    }

    // Отправляем сообщение
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
        reply_markup: keyboard,
        disable_web_page_preview: true,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      console.error("Telegram API error:", result)
      throw new Error(`Telegram API error: ${result.description}`)
    }

    console.log(`Message sent successfully: ${result.result.message_id}`)

    return {
      message_id: result.result.message_id,
      messageText: message,
    }
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

// Остальные функции остаются без изменений...
export async function sendTelegramMessage(chatId: number, message: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error sending telegram message:", error)
    throw error
  }
}

export async function sendTelegramMessageWithButtons(
  chatId: number,
  message: string,
  messageId: number,
  previousTelegramMessageId?: number | null,
) {
  try {
    // Удаляем предыдущее сообщение если есть
    if (previousTelegramMessageId) {
      try {
        await fetch(`${TELEGRAM_API_URL}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: previousTelegramMessageId,
          }),
        })
      } catch (error) {
        console.log("Could not delete previous message:", error)
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Принять", callback_data: `confirm_${messageId}` },
          { text: "❌ Отклонить", callback_data: `reject_${messageId}` },
        ],
        [{ text: "🚫 Отказаться", callback_data: `decline_${messageId}` }],
      ],
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        reply_markup: keyboard,
        disable_web_page_preview: true,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }

    return {
      message_id: result.result.message_id,
      messageText: message,
    }
  } catch (error) {
    console.error("Error sending message with buttons:", error)
    throw error
  }
}
