import { AppConfig } from "./app-config"
import { normalizePhoneNumber } from "./utils"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const NEXT_PUBLIC_BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set")
}

if (!NEXT_PUBLIC_BOT_USERNAME) {
  console.error("NEXT_PUBLIC_BOT_USERNAME is not set")
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

interface TelegramResponse {
  ok: boolean
  result?: any
  description?: string
  error_code?: number
}

interface SendMessageOptions {
  chat_id: number | string
  text: string
  parse_mode?: "HTML" | "MarkdownV2" | "Markdown"
  reply_markup?: any
  disable_web_page_preview?: boolean
  disable_notification?: boolean
  protect_content?: boolean
  reply_to_message_id?: number
  allow_sending_without_reply?: boolean
}

interface SetWebhookOptions {
  url: string
  ip_address?: string
  max_connections?: number
  allowed_updates?: string[]
  drop_pending_updates?: boolean
  secret_token?: string
}

interface BotCommand {
  command: string
  description: string
}

interface TripPoint {
  point_id: string
  point_type: "P" | "D"
  point_num: number
  point_name?: string
  latitude?: string
  longitude?: string
}

interface TripData {
  trip_id?: number // Optional for new trips
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  points: TripPoint[]
}

export async function callTelegramApi(method: string, data: Record<string, any> = {}): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_BASE}/${method}`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
    const json: TelegramResponse = await response.json()
    if (!json.ok) {
      console.error(`Telegram API error for method ${method}:`, json.description)
    }
    return json
  } catch (error) {
    console.error(`Error calling Telegram API method ${method}:`, error)
    return { ok: false, description: (error as Error).message }
  }
}

export async function sendMessage(options: SendMessageOptions): Promise<TelegramResponse> {
  return callTelegramApi("sendMessage", options)
}

export async function setWebhook(options: SetWebhookOptions): Promise<TelegramResponse> {
  return callTelegramApi("setWebhook", options)
}

export async function deleteWebhook(drop_pending_updates = false): Promise<TelegramResponse> {
  return callTelegramApi("deleteWebhook", { drop_pending_updates })
}

export async function getWebhookInfo(): Promise<TelegramResponse> {
  return callTelegramApi("getWebhookInfo")
}

export async function getMe(): Promise<TelegramResponse> {
  return callTelegramApi("getMe")
}

export async function getUpdates(offset?: number, limit?: number, timeout?: number): Promise<TelegramResponse> {
  const data: Record<string, any> = {}
  if (offset !== undefined) data.offset = offset
  if (limit !== undefined) data.limit = limit
  if (timeout !== undefined) data.timeout = timeout
  return callTelegramApi("getUpdates", data)
}

export async function setMyCommands(commands: BotCommand[]): Promise<TelegramResponse> {
  return callTelegramApi("setMyCommands", { commands })
}

export async function getMyCommands(): Promise<TelegramResponse> {
  return callTelegramApi("getMyCommands")
}

export async function deleteMyCommands(): Promise<TelegramResponse> {
  return callTelegramApi("deleteMyCommands")
}

export async function editMessageText(
  chat_id: number | string,
  message_id: number,
  text: string,
  parse_mode?: "HTML" | "MarkdownV2" | "Markdown",
  reply_markup?: any,
): Promise<TelegramResponse> {
  return callTelegramApi("editMessageText", {
    chat_id,
    message_id,
    text,
    parse_mode,
    reply_markup,
  })
}

export async function sendTripMessage(
  chatId: number,
  trips: TripData[],
  isCorrection = false,
  deletedTripIdentifiers: string[] = [],
  originalMessageId?: number, // For editing existing message
): Promise<{ success: boolean; telegramMessageId?: number; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token is not configured." }
  }

  let messageText = ""
  const reply_markup: any = {
    inline_keyboard: [],
  }

  if (isCorrection) {
    messageText += "🔄 *Корректировка рейсов*\n\n"
    if (deletedTripIdentifiers.length > 0) {
      messageText += `❌ Удалены рейсы: ${deletedTripIdentifiers.join(", ")}\n\n`
    }
  } else {
    messageText += "✅ *Новые рейсы*\n\n"
  }

  trips.forEach((trip, index) => {
    const plannedTime = new Date(trip.planned_loading_time).toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })

    messageText += `*Рейс ${index + 1}:* ${trip.trip_identifier}\n`
    messageText += `🚚 Номер ТС: ${trip.vehicle_number}\n`
    messageText += `⏰ Время погрузки: ${plannedTime}\n`

    if (trip.driver_comment) {
      messageText += `💬 Комментарий: ${trip.driver_comment}\n`
    }

    trip.points
      .sort((a, b) => a.point_num - b.point_num)
      .forEach((point) => {
        const type = point.point_type === "P" ? "⬆️ Погрузка" : "⬇️ Выгрузка"
        messageText += `  - ${type}: ${point.point_name || point.point_id}\n`
      })
    messageText += "\n"

    // Add buttons for each trip
    reply_markup.inline_keyboard.push([
      {
        text: `✅ Принять рейс ${trip.trip_identifier}`,
        callback_data: `confirm_trip:${trip.trip_id || trip.trip_identifier}`,
      },
    ])
    reply_markup.inline_keyboard.push([
      {
        text: `❌ Отказаться от рейса ${trip.trip_identifier}`,
        callback_data: `reject_trip:${trip.trip_id || trip.trip_identifier}`,
      },
    ])
  })

  // Add a general decline button if there are multiple trips or if it's a correction
  if (trips.length > 1 || isCorrection) {
    reply_markup.inline_keyboard.push([
      {
        text: "🚫 Отказаться от всех рейсов",
        callback_data: `decline_all_trips`,
      },
    ])
  }

  try {
    let response: TelegramResponse
    if (isCorrection && originalMessageId) {
      // If it's a correction and we have the original message ID, edit the message
      response = await editMessageText(chatId, originalMessageId, messageText, "MarkdownV2", reply_markup)
    } else {
      // Otherwise, send a new message
      response = await sendMessage({
        chat_id: chatId,
        text: messageText,
        parse_mode: "MarkdownV2",
        reply_markup: reply_markup,
      })
    }

    if (response.ok) {
      return { success: true, telegramMessageId: response.result.message_id }
    } else {
      return { success: false, error: response.description }
    }
  } catch (error: any) {
    console.error("Error sending trip message to Telegram:", error)
    return { success: false, error: error.message }
  }
}

export async function sendWelcomeMessage(chatId: number, username: string): Promise<TelegramResponse> {
  const welcomeText = `
Привет, ${username}! 👋
Я бот-диспетчер, который поможет тебе получать и управлять рейсами.

Чтобы начать работу, пожалуйста, подтверди свой номер телефона.
Нажми на кнопку "Подтвердить номер телефона" ниже.
`
  return sendMessage({
    chat_id: chatId,
    text: welcomeText,
    reply_markup: {
      keyboard: [
        [
          {
            text: "📞 Подтвердить номер телефона",
            request_contact: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })
}

export async function sendPhoneVerificationSuccess(chatId: number): Promise<TelegramResponse> {
  const text = `
✅ Отлично! Ваш номер телефона подтвержден.
Теперь вы можете получать рейсы.
`
  return sendMessage({
    chat_id: chatId,
    text: text,
    reply_markup: {
      remove_keyboard: true,
    },
  })
}

export async function sendPhoneVerificationFailed(chatId: number): Promise<TelegramResponse> {
  const text = `
❌ Не удалось подтвердить номер телефона.
Пожалуйста, убедитесь, что вы отправляете свой контакт, а не просто вводите номер.
Попробуйте еще раз, нажав на кнопку "Подтвердить номер телефона".
`
  return sendMessage({
    chat_id: chatId,
    text: text,
    reply_markup: {
      keyboard: [
        [
          {
            text: "📞 Подтвердить номер телефона",
            request_contact: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })
}

export async function sendTripConfirmation(
  chatId: number,
  tripIdentifier: string,
  status: "confirmed" | "rejected" | "declined",
): Promise<TelegramResponse> {
  let text = ""
  switch (status) {
    case "confirmed":
      text = `✅ Рейс ${tripIdentifier} успешно подтвержден!`
      break
    case "rejected":
      text = `❌ Вы отказались от рейса ${tripIdentifier}.`
      break
    case "declined":
      text = `🚫 Вы отказались от всех предложенных рейсов.`
      break
  }
  return sendMessage({ chat_id: chatId, text: text })
}

export async function sendAdminNotification(chatId: number, message: string): Promise<TelegramResponse> {
  const SUPPORT_OPERATOR_CHAT_ID = process.env.SUPPORT_OPERATOR_CHAT_ID
  if (!SUPPORT_OPERATOR_CHAT_ID) {
    console.warn("SUPPORT_OPERATOR_CHAT_ID is not set. Admin notifications will not be sent.")
    return { ok: false, description: "Admin chat ID not configured." }
  }
  return sendMessage({ chat_id: SUPPORT_OPERATOR_CHAT_ID, text: message })
}

export async function sendDriverNotFoundMessage(chatId: number, phone: string): Promise<TelegramResponse> {
  const text = `
К сожалению, ваш номер телефона (${normalizePhoneNumber(phone)}) не найден в нашей системе.
Пожалуйста, свяжитесь с администратором для регистрации.
`
  return sendMessage({ chat_id: chatId, text: text })
}

export async function sendDriverNotVerifiedMessage(chatId: number, phone: string): Promise<TelegramResponse> {
  const text = `
Ваш номер телефона (${normalizePhoneNumber(phone)}) еще не верифицирован администратором.
Пожалуйста, дождитесь подтверждения или свяжитесь с администратором.
`
  return sendMessage({ chat_id: chatId, text: text })
}

export async function sendErrorMessage(chatId: number, errorMessage: string): Promise<TelegramResponse> {
  const text = `
Произошла ошибка:
\`\`\`
${errorMessage}
\`\`\`
Пожалуйста, попробуйте еще раз или свяжитесь с администратором.
`
  return sendMessage({ chat_id: chatId, text: text, parse_mode: "MarkdownV2" })
}

export async function sendDebugMessage(chatId: number, message: string): Promise<TelegramResponse> {
  if (AppConfig.DEBUG_MODE) {
    return sendMessage({ chat_id: chatId, text: `DEBUG: ${message}` })
  }
  return { ok: true } // Do nothing if debug mode is off
}

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

export async function sendReplyToMessage(chatId: number, replyToMessageId: number, text: string) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_to_message_id: replyToMessageId,
    }

    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send reply message")
    }

    return data.result
  } catch (error) {
    console.error("Error sending reply message:", error)
    await sendMessage(chatId, text)
    throw error
  }
}

export async function sendContactRequest(chatId: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Пожалуйста, поделитесь своим номером телефона для регистрации в системе рассылки.",
        reply_markup: {
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
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send contact request")
    }

    return data.result
  } catch (error) {
    console.error("Error sending contact request:", error)
    throw error
  }
}

export async function sendMultipleTripMessageWithButtons(
  chatId: number,
  trips: Array<{
    trip_identifier: string
    vehicle_number: string
    planned_loading_time: string
    driver_comment: string
    loading_points: Array<{
      point_id: string
      point_name: string
      door_open_1?: string
      door_open_2?: string
      door_open_3?: string
      latitude?: number | string
      longitude?: number | string
      adress?: string
      point_num?: string
    }>
    unloading_points: Array<{
      point_id: string
      point_name: string
      door_open_1?: string
      door_open_2?: string
      door_open_3?: string
      latitude?: number | string
      longitude?: number | string
      adress?: string // Добавлено поле адреса
      point_num?: string
    }>
  }>,
  firstName: string,
  messageId: number,
  isCorrection = false,
  isResend = false,
  previousTelegramMessageId?: number,
): Promise<{ message_id: number; messageText: string }> {
  try {
    console.log(`=== SENDING MULTIPLE TRIP MESSAGE ===`)
    console.log(
      `Chat ID: ${chatId}, Trips count: ${trips.length}, Is correction: ${isCorrection}, Is resend: ${isResend}`,
    )
    console.log(`Previous Telegram Message ID: ${previousTelegramMessageId || "None"}`)

    // Генерируем красивое сообщение для нового сообщения
    let message = ""

    // Обновляем логику выбора шапки сообщения
    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
      console.log("Added correction header")
    } else if (isResend) {
      message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
      console.log("Added resend header")
    }

    message += `🌅 <b>Доброго времени суток!</b>\n\n`
    message += `👤 Уважаемый, <b>${firstName}</b>\n\n`

    // Определяем множественное или единственное число
    const isMultiple = trips.length > 1
    message += `🚛 На Вас запланирован${isMultiple ? "ы" : ""} <b>${trips.length} рейс${trips.length > 1 ? "а" : ""}:</b>\n\n`

    // Сортируем рейсы по времени погрузки
    const sortedTrips = [...trips].sort((a, b) => {
      const timeA = new Date(a.planned_loading_time || "").getTime()
      const timeB = new Date(b.planned_loading_time || "").getTime()
      return timeA - timeB
    })

    // Перебираем все рейсы
    sortedTrips.forEach((trip, tripIndex) => {
      console.log(`Processing trip ${tripIndex + 1}: ${trip.trip_identifier}`)

      message += `<b>Рейс ${tripIndex + 1}:</b>\n`
      message += `Транспортировка: <b>${trip.trip_identifier}</b>\n`
      message += `🚗 Транспорт: <b>${trip.vehicle_number}</b>\n`

      // Форматируем дату и время БЕЗ смещения часового пояса
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

      // Объединяем все пункты и сортируем по point_num
      const allPoints = [
        ...trip.loading_points.map((point) => ({ ...point, type: "loading" })),
        ...trip.unloading_points.map((point) => ({ ...point, type: "unloading" })),
      ].sort((a, b) => {
        const aNum = Number.parseInt(a.point_num || "0")
        const bNum = Number.parseInt(b.point_num || "0")
        return aNum - bNum
      })

      if (allPoints.length > 0) {
        message += `📍 <b>Маршрут:</b>\n`
        allPoints.forEach((point, index) => {
          const typeIcon = point.type === "loading" ? "📦" : "📤"
          const typeText = point.type === "loading" ? "Погрузка" : "Разгрузка"
          const pointNum = point.point_num || index + 1

          message += `${pointNum}) ${typeIcon} <b>${point.point_id} ${point.point_name}</b> (${typeText})\n`

          // Добавляем адрес с гиперссылкой
          if (point.adress) {
            if (point.latitude && point.longitude) {
              const lat = typeof point.latitude === "string" ? point.latitude : String(point.latitude)
              const lng = typeof point.longitude === "string" ? point.longitude : String(point.longitude)
              const mapUrl = `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`
              message += `   📍 <a href="${mapUrl}">${point.adress}</a>\n`
            } else {
              message += `   📍 ${point.adress}\n`
            }
          }

          // Окна приемки (только для разгрузки)
          if (point.type === "unloading") {
            const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
            if (windows.length > 0) {
              message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>\n`
            }
          }
        })
        message += `\n`
      }

      // Комментарий
      if (trip.driver_comment && trip.driver_comment.trim()) {
        message += `💬 <b>Комментарий по рейсу:</b>\n<i>${trip.driver_comment}</i>\n\n`
      }

      // Строим маршрут для этого рейса
      const routePoints = allPoints
      console.log(
        `Route points for trip ${trip.trip_identifier}:`,
        routePoints.map((p) => ({ id: p.point_id, lat: p.latitude, lng: p.longitude })),
      )

      const routeUrl = buildRouteUrl(routePoints)

      if (routeUrl) {
        message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>\n\n`
        console.log(`Added route URL for trip ${trip.trip_identifier}`)
      } else {
        console.log(`No route URL generated for trip ${trip.trip_identifier} - insufficient coordinates`)
      }

      // Добавляем разделитель между рейсами (кроме последнего)
      if (tripIndex < sortedTrips.length - 1) {
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }
    })

    message += `🙏 <b>Просьба подтвердить рейс${isMultiple ? "ы" : ""}</b>`

    console.log(`Final message length: ${message.length}`)
    console.log(`Message preview: ${message.substring(0, 200)}...`)

    // Если есть previousTelegramMessageId, редактируем старое сообщение
    if (previousTelegramMessageId) {
      try {
        // Получаем текст старого сообщения (можно использовать заглушку, так как мы зачеркиваем)
        const strikethroughMessage = `<s>Устаревшее сообщение. Пожалуйста, используйте новое сообщение ниже.</s>`

        const editResponse = await fetch(`${TELEGRAM_API_BASE}/editMessageText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: previousTelegramMessageId,
            text: strikethroughMessage,
            parse_mode: "HTML",
            reply_markup: {}, // Удаляем кнопки, передавая пустой reply_markup
          }),
        })

        const editData = await editResponse.json()
        if (!editData.ok) {
          console.error(`Failed to edit message ${previousTelegramMessageId}:`, editData.description)
          // Продолжаем выполнение, даже если редактирование не удалось
        } else {
          console.log(`Successfully edited message ${previousTelegramMessageId} to strikethrough and removed buttons`)
        }
      } catch (error) {
        console.error(`Error editing message ${previousTelegramMessageId}:`, error)
        // Продолжаем выполнение, даже если редактирование не удалось
      }
    }

    // Отправляем новое сообщение
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        reply_markup: {
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
        },
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send multiple trip message with buttons")
    }

    console.log(`Message sent successfully, message_id: ${data.result.message_id}`)
    return { message_id: data.result.message_id, messageText: message }
  } catch (error) {
    console.error("Error sending multiple trip message with buttons:", error)
    throw error
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
) {
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

    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        reply_markup: {
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
        },
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send trip message with buttons")
    }

    return data.result
  } catch (error) {
    console.error("Error sending trip message with buttons:", error)
    throw error
  }
}

export async function sendMessageWithButtons(chatId: number, text: string, messageId: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: {
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
        },
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send message with buttons")
    }

    return data.result
  } catch (error) {
    console.error("Error sending Telegram message with buttons:", error)
    throw error
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to answer callback query")
    }

    return data.result
  } catch (error) {
    console.error("Error answering callback query:", error)
    throw error
  }
}

export async function sendTelegramMessage(chatId: number, text: string, messageId?: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: messageId
          ? {
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
          : undefined,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send message")
    }

    return data.result
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    throw error
  }
}

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup?: any) {
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

    const response = await fetch(`${TELEGRAM_API_BASE}/editMessageReplyMarkup`, {
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
      return null
    }

    console.log("=== MESSAGE REPLY MARKUP EDITED SUCCESSFULLY ===")
    return data.result
  } catch (error) {
    console.error("Error editing message reply markup:", error)
    return null
  }
}

// Функция для построения URL маршрута в Яндекс.Картах
function buildRouteUrl(points: Array<{ latitude?: number | string; longitude?: number | string }>) {
  const validPoints = points.filter((p) => {
    const lat = typeof p.latitude === "string" ? Number.parseFloat(p.latitude) : p.latitude
    const lng = typeof p.longitude === "string" ? Number.parseFloat(p.longitude) : p.longitude
    return lat && lng && !isNaN(lat) && !isNaN(lng)
  })

  // ИЗМЕНЕНО: Проверяем, что ВСЕ точки имеют координаты
  if (validPoints.length !== points.length || validPoints.length < 2) {
    console.log(`Cannot build route: ${validPoints.length} valid points out of ${points.length} total points`)
    return null
  }

  const coordinates = validPoints
    .map((p) => {
      const lat = typeof p.latitude === "string" ? Number.parseFloat(p.latitude) : p.latitude
      const lng = typeof p.longitude === "string" ? Number.parseFloat(p.longitude) : p.longitude
      return `${lat},${lng}`
    })
    .join("~")

  const url = `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`
  console.log(`Built route URL: ${url}`)
  return url
}

export async function deleteMessage(chatId: number, messageId: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/deleteMessage`, {
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
