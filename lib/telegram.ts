import { TELEGRAM_BOT_TOKEN } from "@/lib/app-config"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export interface TelegramMessage {
  message_id: number
  from: {
    id: number
    first_name: string
    last_name?: string
    username?: string
  }
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

export interface TelegramCallbackQuery {
  id: string
  from: {
    id: number
    first_name: string
    last_name?: string
    username?: string
  }
  message?: TelegramMessage
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface PointData {
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name?: string
  latitude?: string
  longitude?: string
  address?: string
  reception_windows?: string
}

interface TripMessageData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  points: PointData[]
}

interface TelegramResponse {
  ok: boolean
  result?: any
  description?: string
  error_code?: number
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  parseMode: "HTML" | "MarkdownV2" | undefined = "HTML",
): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/sendMessage`
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("Telegram API error:", data)
    }
    return data
  } catch (error) {
    console.error("Error sending message to Telegram:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function sendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: any,
): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/sendPhoto`
  const payload = {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption,
    reply_markup: replyMarkup,
    parse_mode: "HTML",
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("Telegram API error (sendPhoto):", data)
    }
    return data
  } catch (error) {
    console.error("Error sending photo to Telegram:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function sendDocument(
  chatId: number | string,
  documentUrl: string,
  caption?: string,
  replyMarkup?: any,
): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/sendDocument`
  const payload = {
    chat_id: chatId,
    document: documentUrl,
    caption: caption,
    reply_markup: replyMarkup,
    parse_mode: "HTML",
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("Telegram API error (sendDocument):", data)
    }
    return data
  } catch (error) {
    console.error("Error sending document to Telegram:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function sendLocation(
  chatId: number | string,
  latitude: number,
  longitude: number,
  replyMarkup?: any,
): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/sendLocation`
  const payload = {
    chat_id: chatId,
    latitude: latitude,
    longitude: longitude,
    reply_markup: replyMarkup,
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("Telegram API error (sendLocation):", data)
    }
    return data
  } catch (error) {
    console.error("Error sending location to Telegram:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function setWebhook(url: string): Promise<TelegramResponse> {
  const webhookUrl = `${TELEGRAM_API_URL}/setWebhook?url=${url}`
  try {
    const response = await fetch(webhookUrl)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error setting webhook:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function getWebhookInfo(): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/getWebhookInfo`
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting webhook info:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function deleteWebhook(): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/deleteWebhook`
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function getMe(): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/getMe`
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting bot info:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function getUpdates(offset?: number): Promise<TelegramResponse> {
  let url = `${TELEGRAM_API_URL}/getUpdates`
  if (offset) {
    url += `?offset=${offset}`
  }
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting updates:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function setMyCommands(commands: { command: string; description: string }[]): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/setMyCommands`
  const payload = {
    commands: commands,
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error setting commands:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function getMyCommands(): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/getMyCommands`
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting commands:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function deleteMyCommands(): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/deleteMyCommands`
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deleting commands:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function sendMultipleTripMessageWithButtons(
  driverPhone: string,
  trips: TripMessageData[],
  isCorrection = false,
  isResend = false,
  deletedTrips: string[] = [],
) {
  try {
    const user = await sql`SELECT telegram_id FROM users WHERE phone = ${driverPhone}`
    if (user.length === 0 || !user[0].telegram_id) {
      return { success: false, error: `Telegram ID not found for phone: ${driverPhone}` }
    }
    const chatId = user[0].telegram_id

    let totalSent = 0
    let totalErrors = 0
    const results = []

    let message = ""

    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
    } else if (isResend) {
      message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
    }

    if (deletedTrips.length > 0) {
      message += `❌ <b>Удаленные рейсы:</b> ${deletedTrips.join(", ")}\n\n`
    }

    const sortedTrips = [...trips].sort((a, b) => {
      // Sort by planned_loading_time first
      const timeA = new Date(a.planned_loading_time).getTime()
      const timeB = new Date(b.planned_loading_time).getTime()
      if (timeA !== timeB) {
        return timeA - timeB
      }
      // Then by trip_identifier
      return a.trip_identifier.localeCompare(b.trip_identifier)
    })

    sortedTrips.forEach((trip, tripIndex) => {
      message += `<b>Рейс ${tripIndex + 1}:</b>\n`
      message += `Транспортировка: <code>${trip.trip_identifier}</code>\n`
      message += `Транспорт: <code>${trip.vehicle_number}</code>\n`

      const plannedTime = new Date(trip.planned_loading_time)
      const formattedDate = plannedTime.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      })
      const formattedTime = plannedTime.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
      message += `Плановое время погрузки: ${formattedDate} ${formattedTime}\n`

      if (trip.driver_comment) {
        message += `Комментарий: ${trip.driver_comment}\n`
      }

      message += `Маршрут:\n`

      // Combine and sort all points by point_num
      const allPoints = [...trip.points].sort((a, b) => a.point_num - b.point_num)

      let hasAllCoordinates = true
      allPoints.forEach((point, index) => {
        const pointTypeIcon = point.point_type === "P" ? "📦" : "📤"
        const pointTypeName = point.point_type === "P" ? "Погрузка" : "Разгрузка"
        message += `${index + 1}) ${pointTypeIcon} <b>${point.point_id}</b> ${point.point_name} (${pointTypeName})\n`
        if (point.address) {
          message += `    ${point.address}\n`
        }
        if (point.reception_windows) {
          message += `    Окна приемки: ${point.reception_windows}\n`
        }
        if (!point.latitude || !point.longitude) {
          hasAllCoordinates = false
        }
      })

      if (hasAllCoordinates) {
        const routeUrl = buildRouteUrl(allPoints)
        if (routeUrl) {
          message += `   <a href="${routeUrl}">Построить маршрут</a>\n`
        }
      }

      message += "\n" // Add a newline between trips
    })

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", callback_data: `confirm_${driverPhone}` },
          { text: "❌ Отклонить", callback_data: `reject_${driverPhone}` },
        ],
      ],
    }

    const response = await sendTelegramMessage(chatId, message, inlineKeyboard)

    if (response.ok) {
      totalSent++
      results.push({ phone: driverPhone, status: "sent" })
    } else {
      totalErrors++
      results.push({ phone: driverPhone, status: "error", error: response.description })
    }

    return {
      success: totalErrors === 0,
      results: {
        total: trips.length,
        sent: totalSent,
        errors: totalErrors,
        details: results,
      },
      error: totalErrors > 0 ? "Some messages failed to send" : undefined,
    }
  } catch (error: any) {
    console.error("Error in sendMultipleTripMessageWithButtons:", error)
    return { success: false, error: error.message }
  }
}

function buildRouteUrl(points: PointData[]): string | null {
  // Проверяем, что все точки имеют координаты
  const allPointsHaveCoordinates = points.every(
    (p) => p.latitude && p.longitude && !isNaN(Number.parseFloat(p.latitude)) && !isNaN(Number.parseFloat(p.longitude)),
  )

  if (!allPointsHaveCoordinates || points.length < 2) {
    return null // Не строим маршрут, если нет координат у всех точек или точек меньше двух
  }

  const baseUrl = "https://yandex.ru/maps/?"
  const routePoints = points
    .map((p) => `${Number.parseFloat(p.longitude!)},${Number.parseFloat(p.latitude!)}`)
    .join("~")
  return `${baseUrl}rtext=${routePoints}&rtt=auto`
}

export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup?: any,
): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_URL}/editMessageReplyMarkup`

  console.log("=== EDITING MESSAGE REPLY MARKUP ===")
  console.log("Chat ID:", chatId)
  console.log("Message ID:", messageId)
  console.log("New reply markup:", JSON.stringify(replyMarkup, null, 2))

  try {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log("editMessageReplyMarkup response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      console.error("Failed to edit message reply markup:", data.description)
      return { ok: false, description: data.description }
    }

    console.log("=== MESSAGE REPLY MARKUP EDITED SUCCESSFULLY ===")
    return data
  } catch (error) {
    console.error("Error editing message reply markup:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function sendContactRequest(chatId: number): Promise<TelegramResponse> {
  try {
    const response = await sendTelegramMessage(
      chatId,
      "Пожалуйста, поделитесь своим номером телефона для регистрации в системе рассылки.",
      {
        keyboard: [
          [
            {
              text: "📱 Поделиться номером",
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    )

    if (!response.ok) {
      throw new Error(response.description || "Failed to send contact request")
    }

    return response
  } catch (error: any) {
    console.error("Error sending contact request:", error)
    return { ok: false, description: error.message }
  }
}

export async function sendTripMessageWithButtons(
  chatId: number,
  tripData: {
    trip_identifier: string
    vehicle_number: string
    planned_loading_time: string
    driver_comment: string
  },
  loadingPoints: Array<{
    point_name: string
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: number | string
    longitude?: number | string
  }>,
  unloadingPoints: Array<{
    point_name: string
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: number | string
    longitude?: number | string
  }>,
  firstName: string,
  messageId: number,
): Promise<TelegramResponse> {
  try {
    // Генерируем красивое сообщение
    let message = `🌅 <b>Доброго времени суток!</b>\n\n`
    message += `👤 Уважаемый, <b>${firstName}</b>\n\n`
    message += `🚛 На Вас запланирован рейс <b>${tripData.trip_identifier}</b>\n`
    message += `🚗 Транспорт: <b>${tripData.vehicle_number}</b>\n`
    message += `⏰ Плановое время погрузки: <b>${tripData.planned_loading_time}</b>\n\n`

    // Пункты погрузки
    if (loadingPoints.length > 0) {
      message += `📦 <b>Погрузка:</b>\n`
      loadingPoints.forEach((point, index) => {
        message += `${index + 1}) <b>${point.point_name}</b>\n`
      })
      message += `\n`
    }

    // Пункты разгрузки
    if (unloadingPoints.length > 0) {
      message += `📤 <b>Разгрузка:</b>\n`
      unloadingPoints.forEach((point, index) => {
        message += `${index + 1}) <b>${point.point_name}</b>\n`

        // Окна приемки для пункта разгрузки
        const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
        if (windows.length > 0) {
          message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>\n`
        }
        message += `\n`
      })
    }

    // Комментарий
    if (tripData.driver_comment && tripData.driver_comment.trim()) {
      message += `💬 <b>Комментарий по рейсу:</b>\n<i>${tripData.driver_comment}</i>\n\n`
    }

    // Строим маршрут: сначала все точки погрузки, потом все точки разгрузки
    const routePoints = [...loadingPoints, ...unloadingPoints]
    const routeUrl = buildRouteUrl(routePoints)

    if (routeUrl) {
      message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>\n\n`
    }

    message += `🙏 <b>Просьба подтвердить рейс</b>`

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Подтвердить",
            callback_data: `confirm_${messageId}`,
          },
          {
            text: "❌ Отклонить",
            callback_data: `reject_${messageId}`,
          },
        ],
      ],
    }

    const response = await sendTelegramMessage(chatId, message, inlineKeyboard)

    if (!response.ok) {
      throw new Error(response.description || "Failed to send trip message with buttons")
    }

    return response
  } catch (error: any) {
    console.error("Error sending trip message with buttons:", error)
    return { ok: false, description: error.message }
  }
}

export async function sendMessageWithButtons(
  chatId: number,
  text: string,
  messageId: number,
): Promise<TelegramResponse> {
  try {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Подтвердить",
            callback_data: `confirm_${messageId}`,
          },
          {
            text: "❌ Отклонить",
            callback_data: `reject_${messageId}`,
          },
        ],
      ],
    }

    const response = await sendTelegramMessage(chatId, text, inlineKeyboard)

    if (!response.ok) {
      throw new Error(response.description || "Failed to send message with buttons")
    }

    return response
  } catch (error: any) {
    console.error("Error sending Telegram message with buttons:", error)
    return { ok: false, description: error.message }
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<TelegramResponse> {
  try {
    const url = `${TELEGRAM_API_URL}/answerCallbackQuery`
    const payload = {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: false,
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error("Telegram API error (answerCallbackQuery):", data)
    }
    return data
  } catch (error) {
    console.error("Error answering callback query:", error)
    return { ok: false, description: "Network error or invalid response" }
  }
}

export async function deleteMessage(chatId: number, messageId: number): Promise<boolean> {
  const url = `${TELEGRAM_API_URL}/deleteMessage`
  const payload = {
    chat_id: chatId,
    message_id: messageId,
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!data.ok) {
      console.warn(`Failed to delete message ${messageId} in chat ${chatId}:`, data.description)
      return false
    }

    console.log(`Successfully deleted message ${messageId} in chat ${chatId}`)
    return true
  } catch (error) {
    console.error("Error deleting Telegram message:", error)
    return false
  }
}
