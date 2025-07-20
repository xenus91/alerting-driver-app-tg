import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// Интерфейсы для типизации
interface Point {
  point_id: string
  point_name: string
  adress?: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: number
  longitude?: number
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

// Функция для нормализации номера телефона
export function normalizePhoneNumber(phone: string): string {
  // Удаляем все символы кроме цифр
  const digits = phone.replace(/\D/g, "")

  // Если номер начинается с 8, заменяем на 7
  if (digits.startsWith("8") && digits.length === 11) {
    return "7" + digits.slice(1)
  }

  // Если номер начинается с 7 и имеет 11 цифр, возвращаем как есть
  if (digits.startsWith("7") && digits.length === 11) {
    return digits
  }

  // Если номер имеет 10 цифр, добавляем 7 в начало
  if (digits.length === 10) {
    return "7" + digits
  }

  // В остальных случаях возвращаем как есть
  return digits
}

// Функция для построения URL маршрута
function buildRouteUrl(points: Point[]): string | null {
  // Проверяем, что все точки имеют координаты
  const validPoints = points.filter((point) => point.latitude && point.longitude)

  if (validPoints.length !== points.length || validPoints.length === 0) {
    console.log("Not all points have coordinates, skipping route building")
    return null
  }

  const coordinates = validPoints.map((point) => `${point.longitude},${point.latitude}`).join("~")

  return `https://yandex.ru/maps/?rtext=${coordinates}&rtt=auto`
}

// Функция для отправки сообщения с несколькими рейсами и кнопками
export async function sendMultipleTripMessageWithButtons(
  telegramId: number,
  trips: Trip[],
  driverName: string,
  messageId: number,
  isCorrection = false,
  isResend = false,
  previousTelegramMessageId?: number | null,
): Promise<{ message_id: number; messageText: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set")
  }

  // Сортируем рейсы по времени погрузки
  const sortedTrips = trips.sort(
    (a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime(),
  )

  // Формируем сообщение
  let message = ""

  // Добавляем заголовок в зависимости от типа отправки
  if (isCorrection) {
    message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
  } else if (isResend) {
    message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
  }

  message += `Привет, ${driverName}! 👋\n\n`

  // Перебираем все рейсы
  sortedTrips.forEach((trip, tripIndex) => {
    const tripNumber = tripIndex + 1
    const loadingTime = new Date(trip.planned_loading_time).toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    })

    message += `<b>Рейс ${tripNumber}:</b>\n`
    message += `🚛 <b>Транспортировка:</b> ${trip.trip_identifier}\n`
    message += `🚗 <b>Транспорт:</b> ${trip.vehicle_number}\n`
    message += `⏰ <b>Плановое время погрузки:</b> ${loadingTime}\n`

    if (trip.driver_comment) {
      message += `💬 <b>Комментарий:</b> ${trip.driver_comment}\n`
    }

    // Объединяем все точки и сортируем по point_num
    const allPoints: (Point & { point_type: string })[] = [
      ...trip.loading_points.map((p) => ({ ...p, point_type: "P" })),
      ...trip.unloading_points.map((p) => ({ ...p, point_type: "D" })),
    ]

    // Сортируем по point_num
    allPoints.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

    if (allPoints.length > 0) {
      message += `\n📍 <b>Маршрут:</b>\n`

      allPoints.forEach((point, index) => {
        const pointNumber = index + 1
        const pointType = point.point_type === "P" ? "Погрузка" : "Разгрузка"
        const pointIcon = point.point_type === "P" ? "📦" : "📤"

        message += `${pointNumber}) ${pointIcon} ${point.point_id} ${point.point_name} (${pointType})\n`

        if (point.adress) {
          message += `    📍 ${point.adress}\n`
        }

        // Добавляем информацию об окнах приемки для точек разгрузки
        if (point.point_type === "D") {
          const doorTimes = [point.door_open_1, point.door_open_2, point.door_open_3]
            .filter((time) => time && time.trim() !== "")
            .join(" | ")

          if (doorTimes) {
            message += `    🕐 Окна приемки: ${doorTimes}\n`
          }
        }
      })

      // Строим маршрут только если все точки имеют координаты
      const routeUrl = buildRouteUrl(allPoints)
      if (routeUrl) {
        message += `\n🗺 <a href="${routeUrl}">Построить маршрут</a>\n`
      }
    }

    message += `\n`
  })

  message += `Подтвердите получение заявки:`

  // Создаем inline клавиатуру
  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Принять", callback_data: `confirm_${messageId}` },
        { text: "❌ Отклонить", callback_data: `decline_${messageId}` },
      ],
    ],
  }

  try {
    // Удаляем предыдущее сообщение если есть
    if (previousTelegramMessageId) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            message_id: previousTelegramMessageId,
          }),
        })
        console.log(`Deleted previous message ${previousTelegramMessageId}`)
      } catch (deleteError) {
        console.log(`Could not delete previous message: ${deleteError}`)
      }
    }

    // Отправляем новое сообщение
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
      throw new Error(`Telegram API error: ${result.description}`)
    }

    console.log(`Message sent successfully to ${telegramId}, message_id: ${result.result.message_id}`)

    return {
      message_id: result.result.message_id,
      messageText: message,
    }
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

// Функция для отправки простого сообщения
export async function sendTelegramMessage(telegramId: number, message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set")
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }

    console.log(`Simple message sent successfully to ${telegramId}`)
  } catch (error) {
    console.error("Error sending simple message:", error)
    throw error
  }
}

// Функция для редактирования сообщения
export async function editTelegramMessage(telegramId: number, messageId: number, newText: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set")
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        message_id: messageId,
        text: newText,
        parse_mode: "HTML",
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }

    console.log(`Message edited successfully: ${telegramId}/${messageId}`)
  } catch (error) {
    console.error("Error editing message:", error)
    throw error
  }
}

// Функция для удаления сообщения
export async function deleteTelegramMessage(telegramId: number, messageId: number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set")
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        message_id: messageId,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }

    console.log(`Message deleted successfully: ${telegramId}/${messageId}`)
  } catch (error) {
    console.error("Error deleting message:", error)
    throw error
  }
}
