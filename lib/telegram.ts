const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
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

export async function sendMessage(chatId: number, text: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
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

// Функция для построения URL маршрута в Яндекс.Картах
function buildRouteUrl(points: Array<{ latitude?: number; longitude?: number }>) {
  const validPoints = points.filter((p) => p.latitude && p.longitude)

  if (validPoints.length < 2) {
    return null // Нужно минимум 2 точки для маршрута
  }

  const coordinates = validPoints.map((p) => `${p.latitude},${p.longitude}`).join("~")
  return `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`
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
    latitude?: number
    longitude?: number
  }>,
  unloadingPoints: Array<{
    point_name: string
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: number
    longitude?: number
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

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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
      latitude?: number
      longitude?: number
    }>
    unloading_points: Array<{
      point_id: string
      point_name: string
      door_open_1?: string
      door_open_2?: string
      door_open_3?: string
      latitude?: number
      longitude?: number
    }>
  }>,
  firstName: string,
  messageId: number,
) {
  try {
    // Генерируем красивое сообщение
    let message = `🌅 <b>Доброго времени суток!</b>\n\n`
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

      message += `⏰ Плановое время погрузки: <b>${formatDateTime(trip.planned_loading_time)}</b>\n\n`

      // Пункты погрузки
      if (trip.loading_points.length > 0) {
        message += `📦 <b>Погрузка:</b>\n`
        trip.loading_points.forEach((point, index) => {
          message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>\n`
        })
        message += `\n`
      }

      // Пункты разгрузки
      if (trip.unloading_points.length > 0) {
        message += `📤 <b>Разгрузка:</b>\n`
        trip.unloading_points.forEach((point, index) => {
          message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>\n`

          // Окна приемки для пункта разгрузки
          const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
          if (windows.length > 0) {
            message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>\n`
          }
        })
        message += `\n`
      }

      // Комментарий
      if (trip.driver_comment && trip.driver_comment.trim()) {
        message += `💬 <b>Комментарий по рейсу:</b>\n<i>${trip.driver_comment}</i>\n\n`
      }

      // Строим маршрут для этого рейса: сначала все точки погрузки, потом все точки разгрузки
      const routePoints = [...trip.loading_points, ...trip.unloading_points]
      const routeUrl = buildRouteUrl(routePoints)

      if (routeUrl) {
        message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>\n\n`
      }

      // Добавляем разделитель между рейсами (кроме последнего)
      if (tripIndex < sortedTrips.length - 1) {
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }
    })

    message += `🙏 <b>Просьба подтвердить рейс${isMultiple ? "ы" : ""}</b>`

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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

    return data.result
  } catch (error) {
    console.error("Error sending multiple trip message with buttons:", error)
    throw error
  }
}

export async function sendMessageWithButtons(chatId: number, text: string, messageId: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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

export async function sendContactRequest(chatId: number) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
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

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup?: any) {
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
      throw new Error(data.description || "Failed to edit message reply markup")
    }

    return data.result
  } catch (error) {
    console.error("Error editing message reply markup:", error)
    throw error
  }
}

export async function sendTelegramMessage(chatId: number, text: string, messageId?: number) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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

export async function setWebhook(webhookUrl: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error setting webhook:", error)
    throw error
  }
}
