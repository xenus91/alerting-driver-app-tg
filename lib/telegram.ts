import { buildRouteUrl } from "./utils"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: {
    id: number
    type: string
  }
  date: number
  text?: string
  contact?: {
    phone_number: string
    first_name: string
    last_name?: string
    user_id?: number
  }
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
  }
}

export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: InlineKeyboardMarkup) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

export async function sendReplyToMessage(
  chatId: number,
  text: string,
  replyToMessageId: number,
  replyMarkup?: InlineKeyboardMarkup,
) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_to_message_id: replyToMessageId,
        reply_markup: replyMarkup,
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error sending reply message:", error)
    throw error
  }
}

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup?: InlineKeyboardMarkup) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/editMessageReplyMarkup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error editing message reply markup:", error)
    throw error
  }
}

export async function sendContactRequest(chatId: number, text: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          keyboard: [
            [
              {
                text: "📱 Поделиться номером телефона",
                request_contact: true,
              },
            ],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error sending contact request:", error)
    throw error
  }
}

export async function deleteMessage(chatId: number, messageId: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/deleteMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error deleting message:", error)
    throw error
  }
}

export async function sendMultipleTripMessageWithButtons(
  phoneData: Map<string, any>,
  isResend = false,
  isCorrection = false,
) {
  const results = []

  for (const [phone, data] of phoneData) {
    try {
      console.log(`DEBUG: Processing phone ${phone} with ${data.trips.size} trips`)

      if (!data.telegram_id) {
        console.log(`DEBUG: No telegram_id for phone ${phone}, skipping`)
        continue
      }

      let message = ""

      // Заголовок сообщения
      if (isCorrection) {
        message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
      } else if (isResend) {
        message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
      } else {
        message += `🚛 <b>НОВЫЕ ЗАЯВКИ НА ПЕРЕВОЗКУ</b>\n\n`
      }

      // Приветствие
      const driverName = data.full_name || data.first_name || "Водитель"
      message += `Привет, ${driverName}! 👋\n\n`

      // Сортируем рейсы по времени погрузки
      const sortedTrips = Array.from(data.trips.values()).sort((a, b) => {
        const timeA = new Date(a.planned_loading_time).getTime()
        const timeB = new Date(b.planned_loading_time).getTime()
        return timeA - timeB
      })

      console.log(`DEBUG: Processing ${sortedTrips.length} trips for phone ${phone}`)

      // Перебираем все рейсы
      sortedTrips.forEach((trip, tripIndex) => {
        console.log(`DEBUG: Processing trip ${tripIndex + 1}: ${trip.trip_identifier}`)

        message += `<b>Рейс ${tripIndex + 1}:</b>\n`
        message += `🚛 Транспортировка: ${trip.trip_identifier}\n`
        message += `🚗 Транспорт: ${trip.vehicle_number}\n`

        // Форматируем время
        const loadingTime = new Date(trip.planned_loading_time)
        const formattedTime = loadingTime.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
        message += `⏰ Плановое время погрузки: ${formattedTime}\n`

        if (trip.driver_comment) {
          message += `💬 Комментарий: ${trip.driver_comment}\n`
        }

        message += `\n📍 <b>Маршрут:</b>\n`

        // Объединяем все точки и сортируем по point_num
        const allPoints = []

        // Добавляем точки погрузки
        trip.loading_points.forEach((point) => {
          allPoints.push({
            ...point,
            type: "P",
            type_name: "Погрузка",
          })
        })

        // Добавляем точки разгрузки
        trip.unloading_points.forEach((point) => {
          allPoints.push({
            ...point,
            type: "D",
            type_name: "Разгрузка",
          })
        })

        // Сортируем все точки по point_num
        allPoints.sort((a, b) => a.point_num - b.point_num)

        console.log(`DEBUG: Trip ${trip.trip_identifier} has ${allPoints.length} total points`)

        // Выводим все точки в едином списке
        allPoints.forEach((point, pointIndex) => {
          const pointIcon = point.type === "P" ? "📦" : "📤"
          message += `${pointIndex + 1}) ${pointIcon} ${point.point_id} ${point.point_name} (${point.type_name})\n`

          if (point.adress) {
            message += `    📍 ${point.adress}\n`
          }

          // Окна приемки только для точек разгрузки
          if (point.type === "D" && (point.door_open_1 || point.door_open_2 || point.door_open_3)) {
            const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter(Boolean).join(" | ")
            message += `    🕐 Окна приемки: ${windows}\n`
          }
        })

        // Построение маршрута - проверяем, что все точки имеют координаты
        const allPointsHaveCoordinates = allPoints.every(
          (point) =>
            point.latitude &&
            point.longitude &&
            point.latitude.toString().trim() !== "" &&
            point.longitude.toString().trim() !== "",
        )

        if (allPointsHaveCoordinates && allPoints.length > 1) {
          const routeUrl = buildRouteUrl(allPoints)
          if (routeUrl) {
            message += `\n🗺️ <a href="${routeUrl}">Построить маршрут</a>\n`
          }
        }

        message += `\n`
      })

      // Кнопки для ответа
      const keyboard: InlineKeyboardButton[][] = [
        [
          { text: "✅ Принимаю", callback_data: `confirm_${phone}` },
          { text: "❌ Отклоняю", callback_data: `reject_${phone}` },
        ],
      ]

      console.log(`DEBUG: Sending message to telegram_id ${data.telegram_id}`)

      const result = await sendMessage(data.telegram_id, message, {
        inline_keyboard: keyboard,
      })

      console.log(`DEBUG: Message sent successfully to ${phone}`)

      results.push({
        phone,
        telegram_id: data.telegram_id,
        success: true,
        message_id: result.message_id,
      })
    } catch (error) {
      console.error(`Error sending message to ${phone}:`, error)
      results.push({
        phone,
        telegram_id: data.telegram_id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return results
}

export async function setWebhook(url: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error setting webhook:", error)
    throw error
  }
}

export async function getWebhookInfo() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting webhook info:", error)
    throw error
  }
}

export async function deleteWebhook() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`, {
      method: "POST",
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deleting webhook:", error)
    throw error
  }
}

export async function getMe() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMe`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting bot info:", error)
    throw error
  }
}

export async function setMyCommands(commands: Array<{ command: string; description: string }>) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commands,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error setting commands:", error)
    throw error
  }
}

export async function getMyCommands() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMyCommands`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting commands:", error)
    throw error
  }
}

export async function deleteMyCommands() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/deleteMyCommands`, {
      method: "POST",
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deleting commands:", error)
    throw error
  }
}
