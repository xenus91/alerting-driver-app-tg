const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME!

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  date: number
  chat: {
    id: number
    type: string
  }
  text?: string
  contact?: {
    phone_number: string
    first_name: string
    last_name?: string
  }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
  }
}

interface TelegramWebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
  max_connections?: number
  allowed_updates?: string[]
}

interface Point {
  point_id: string
  point_name: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: string
  longitude?: string
  adress?: string
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

export async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("Telegram API error:", data)
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error sending telegram message:", error)
    throw error
  }
}

export async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: any,
): Promise<any> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("Telegram API error:", data)
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error editing telegram message:", error)
    throw error
  }
}

export async function deleteTelegramMessage(chatId: number, messageId: number): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
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
    return data.ok
  } catch (error) {
    console.error("Error deleting telegram message:", error)
    return false
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: showAlert,
      }),
    })

    const data = await response.json()
    return data.ok
  } catch (error) {
    console.error("Error answering callback query:", error)
    return false
  }
}

export async function setTelegramWebhook(url: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        allowed_updates: ["message", "callback_query"],
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(`Failed to set webhook: ${data.description}`)
    }

    return data
  } catch (error) {
    console.error("Error setting webhook:", error)
    throw error
  }
}

export async function getTelegramWebhookInfo(): Promise<TelegramWebhookInfo> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const data = await response.json()

    if (!data.ok) {
      throw new Error(`Failed to get webhook info: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error getting webhook info:", error)
    throw error
  }
}

export async function deleteTelegramWebhook() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
      method: "POST",
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(`Failed to delete webhook: ${data.description}`)
    }

    return data
  } catch (error) {
    console.error("Error deleting webhook:", error)
    throw error
  }
}

export async function getBotInfo() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
    const data = await response.json()

    if (!data.ok) {
      throw new Error(`Failed to get bot info: ${data.description}`)
    }

    return data.result
  } catch (error) {
    console.error("Error getting bot info:", error)
    throw error
  }
}

export async function testBotConnection() {
  try {
    const botInfo = await getBotInfo()
    const webhookInfo = await getTelegramWebhookInfo()

    return {
      bot: botInfo,
      webhook: webhookInfo,
      status: "connected",
    }
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

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

  return `${day} ${monthNames[date.getMonth()]} ${hours}:${minutes}`
}

function buildRouteUrl(points: Point[]): string | null {
  // Проверяем, что все точки имеют координаты
  const validPoints = points.filter((point) => point.latitude && point.longitude)

  if (validPoints.length !== points.length || validPoints.length === 0) {
    // Если не все точки имеют координаты, не строим маршрут
    return null
  }

  const coordinates = validPoints.map((point) => `${point.longitude},${point.latitude}`).join("~")

  return `https://yandex.ru/maps/?rtext=${coordinates}&rtt=auto`
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
    console.log(`Driver Name: ${driverName}`)
    console.log(`Message ID: ${messageId}`)
    console.log(`Is Correction: ${isCorrection}`)
    console.log(`Is Resend: ${isResend}`)
    console.log(`Previous Message ID: ${previousTelegramMessageId}`)
    console.log(`Trips count: ${trips.length}`)

    // Удаляем предыдущее сообщение если есть
    if (previousTelegramMessageId) {
      console.log(`Deleting previous message: ${previousTelegramMessageId}`)
      await deleteTelegramMessage(telegramId, previousTelegramMessageId)
    }

    let message = ""

    // Заголовок в зависимости от типа отправки
    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
    } else if (isResend) {
      message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
    }

    message += `👋 Привет, <b>${driverName}</b>!\n\n`

    if (trips.length === 1) {
      message += `📋 У вас <b>1 новый рейс</b>:\n\n`
    } else {
      message += `📋 У вас <b>${trips.length} новых рейса</b>:\n\n`
    }

    // Сортируем рейсы по времени погрузки
    const sortedTrips = trips.sort(
      (a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime(),
    )

    // Перебираем все рейсы
    sortedTrips.forEach((trip, tripIndex) => {
      message += `<b>Рейс ${tripIndex + 1}:</b>\n`
      message += `🚛 Транспортировка: <b>${trip.trip_identifier}</b>\n`
      message += `🚗 Транспорт: <b>${trip.vehicle_number}</b>\n`
      message += `⏰ Плановое время погрузки: <b>${formatDateTime(trip.planned_loading_time)}</b>\n`

      if (trip.driver_comment) {
        message += `💬 Комментарий: <i>${trip.driver_comment}</i>\n`
      }

      message += `\n📍 <b>Маршрут:</b>\n`

      // Объединяем все точки и сортируем по point_num
      const allPoints: (Point & { point_type: string })[] = [
        ...trip.loading_points.map((p) => ({ ...p, point_type: "P" })),
        ...trip.unloading_points.map((p) => ({ ...p, point_type: "D" })),
      ]

      // Сортируем по point_num
      allPoints.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Выводим точки в едином списке
      allPoints.forEach((point, index) => {
        const pointType = point.point_type === "P" ? "Погрузка" : "Разгрузка"
        const pointIcon = point.point_type === "P" ? "📦" : "📤"

        message += `${index + 1}) ${pointIcon} <b>${point.point_id} ${point.point_name}</b> (${pointType})\n`

        if (point.adress) {
          message += `    📍 ${point.adress}\n`
        }

        // Окна приемки только для разгрузки
        if (point.point_type === "D") {
          const doorTimes = []
          if (point.door_open_1) doorTimes.push(point.door_open_1)
          if (point.door_open_2) doorTimes.push(point.door_open_2)
          if (point.door_open_3) doorTimes.push(point.door_open_3)

          if (doorTimes.length > 0) {
            message += `    🕐 Окна приемки: ${doorTimes.join(" | ")}\n`
          }
        }
      })

      // Строим маршрут только если все точки имеют координаты
      const routeUrl = buildRouteUrl(allPoints)
      if (routeUrl) {
        message += `\n🗺️ <a href="${routeUrl}">Построить маршрут</a>\n`
      }

      if (tripIndex < sortedTrips.length - 1) {
        message += `\n${"─".repeat(30)}\n\n`
      }
    })

    message += `\n\n❓ <b>Подтверждаете выполнение рейсов?</b>`

    // Создаем кнопки
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Подтверждаю",
            callback_data: `confirm_${messageId}`,
          },
          {
            text: "❌ Отклоняю",
            callback_data: `reject_${messageId}`,
          },
        ],
        [
          {
            text: "🚫 Не могу выполнить",
            callback_data: `decline_${messageId}`,
          },
        ],
      ],
    }

    console.log(`Sending message to ${telegramId}`)
    console.log(`Message length: ${message.length}`)

    const result = await sendTelegramMessage(telegramId, message, keyboard)

    console.log(`Message sent successfully, message_id: ${result.message_id}`)

    return {
      message_id: result.message_id,
      messageText: message,
    }
  } catch (error) {
    console.error("Error sending multiple trip message:", error)
    throw error
  }
}

export async function sendTripMessageWithButtons(
  telegramId: number,
  trip: Trip,
  driverName: string,
  messageId: number,
): Promise<{ message_id: number; messageText: string }> {
  return sendMultipleTripMessageWithButtons(telegramId, [trip], driverName, messageId)
}

export type { TelegramUpdate, TelegramMessage, TelegramUser }
