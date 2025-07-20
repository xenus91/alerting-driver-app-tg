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

export async function sendReplyToMessage(chatId: number, replyToMessageId: number, text: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_to_message_id: replyToMessageId,
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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

export async function sendMessage(chatId: number, text: string) {
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
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

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

    const response = await fetch(`${TELEGRAM_API_URL}/editMessageReplyMarkup`, {
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

  if (validPoints.length < 2) {
    console.log(`Not enough valid points for route: ${validPoints.length}`)
    return null // Нужно минимум 2 точки для маршрута
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
    }>
  }>,
  firstName: string,
  messageId: number,
  isCorrection = false,
  // === НАЧАЛО ИЗМЕНЕНИЙ ===
  // Добавлен параметр isResend для различения первичной и повторной отправки
  isResend = false,
  // === КОНЕЦ ИЗМЕНЕНИЙ ===
  previousTelegramMessageId?: number,
): Promise<{ message_id: number; messageText: string }> {
  try {
    console.log(`=== SENDING MULTIPLE TRIP MESSAGE ===`)
    console.log(`Chat ID: ${chatId}, Trips count: ${trips.length}, Is correction: ${isCorrection}`)
    console.log(`Previous Telegram Message ID: ${previousTelegramMessageId || "None"}`)

    // Генерируем красивое сообщение для нового сообщения
    let message = ""

    // === НАЧАЛО ИЗМЕНЕНИЙ ===
    // Обновляем логику выбора шапки сообщения
    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
    } else if (isResend) {
      message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
    }
    // === КОНЕЦ ИЗМЕНЕНИЙ ===

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
        ...trip.loading_points.map((p) => ({ ...p, type: "P" })),
        ...trip.unloading_points.map((p) => ({ ...p, type: "D" })),
      ].sort((a, b) => {
        const numA = Number.parseInt(a.point_id) || 0
        const numB = Number.parseInt(b.point_id) || 0
        return numA - numB
      })

      if (allPoints.length > 0) {
        message += `📍 <b>Пункты маршрута:</b>\n`
        allPoints.forEach((point, index) => {
          const typeIcon = point.type === "P" ? "📦" : "📤"
          const typeText = point.type === "P" ? "Погрузка" : "Разгрузка"

          message += `${index + 1}) ${typeIcon} <b>${point.point_id} ${point.point_name}</b> (${typeText})\n`

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
          if (point.type === "D") {
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
      const routePoints = [...trip.loading_points, ...trip.unloading_points]
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

        const editResponse = await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
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
    let message = `🌅 <b>Доброго времени суток!</b>

`
    message += `👤 Уважаемый, <b>${firstName}</b>

`
    message += `🚛 На Вас запланирован рейс <b>${tripData.trip_identifier}</b>
`
    message += `🚗 Транспорт: <b>${tripData.vehicle_number}</b>
`
    message += `⏰ Плановое время погрузки: <b>${tripData.planned_loading_time}</b>

`

    // Пункты погрузки
    if (loadingPoints.length > 0) {
      message += `📦 <b>Погрузка:</b>
`
      loadingPoints.forEach((point, index) => {
        message += `${index + 1}) <b>${point.point_name}</b>
`
      })
      message += `
`
    }

    // Пункты разгрузки
    if (unloadingPoints.length > 0) {
      message += `📤 <b>Разгрузка:</b>
`
      unloadingPoints.forEach((point, index) => {
        message += `${index + 1}) <b>${point.point_name}</b>
`

        // Окна приемки для пункта разгрузки
        const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
        if (windows.length > 0) {
          message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>
`
        }
        message += `
`
      })
    }

    // Комментарий
    if (tripData.driver_comment && tripData.driver_comment.trim()) {
      message += `💬 <b>Комментарий по рейсу:</b>
<i>${tripData.driver_comment}</i>

`
    }

    // Строим маршрут: сначала все точки погрузки, потом все точки разгрузки
    const routePoints = [...loadingPoints, ...unloadingPoints]
    const routeUrl = buildRouteUrl(routePoints)

    if (routeUrl) {
      message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>

`
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
