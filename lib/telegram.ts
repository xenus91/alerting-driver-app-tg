const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  loading_points: Array<{
    point_id: string
    point_name: string
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: string
    longitude?: string
    adress?: string
    point_num?: number
  }>
  unloading_points: Array<{
    point_id: string
    point_name: string
    door_open_1?: string
    door_open_2?: string
    door_open_3?: string
    latitude?: string
    longitude?: string
    adress?: string
    point_num?: number
  }>
}

function buildRouteUrl(trip: TripData): string | null {
  // Объединяем все точки
  const allPoints = [
    ...trip.loading_points.map((p) => ({ ...p, type: "P" })),
    ...trip.unloading_points.map((p) => ({ ...p, type: "D" })),
  ]

  // Сортируем по point_num
  allPoints.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

  // Проверяем, что ВСЕ точки имеют координаты
  const hasAllCoordinates = allPoints.every(
    (point) => point.latitude && point.longitude && point.latitude.trim() !== "" && point.longitude.trim() !== "",
  )

  if (!hasAllCoordinates) {
    console.log("Not all points have coordinates, skipping route building")
    return null
  }

  // Строим URL для Яндекс.Карт
  const waypoints = allPoints.map((point) => `${point.latitude},${point.longitude}`).join("~")

  return `https://yandex.ru/maps/?rtext=${waypoints}&rtt=auto`
}

export async function sendMultipleTripMessageWithButtons(
  telegramId: number,
  trips: TripData[],
  driverName: string,
  messageId: number,
  isCorrection = false,
  isResend = false,
  previousTelegramMessageId?: number | null,
): Promise<{ message_id: number; messageText: string }> {
  try {
    console.log(`=== SENDING MESSAGE ===`)
    console.log(`Telegram ID: ${telegramId}`)
    console.log(`Driver: ${driverName}`)
    console.log(`Message ID: ${messageId}`)
    console.log(`Is Correction: ${isCorrection}`)
    console.log(`Is Resend: ${isResend}`)
    console.log(`Previous Message ID: ${previousTelegramMessageId}`)
    console.log(`Trips count: ${trips.length}`)

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
        console.log(`Deleted previous message ${previousTelegramMessageId}`)
      } catch (error) {
        console.log(`Failed to delete previous message: ${error}`)
      }
    }

    // Сортируем рейсы по времени погрузки
    const sortedTrips = trips.sort(
      (a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime(),
    )

    let message = `👋 Привет, ${driverName}!\n\n`

    // Добавляем заголовок в зависимости от типа отправки
    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
    } else if (isResend) {
      message += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
    }

    // Перебираем все рейсы
    sortedTrips.forEach((trip, tripIndex) => {
      const tripNumber = tripIndex + 1
      message += `<b>Рейс ${tripNumber}:</b>\n`
      message += `🚛 <b>Транспортировка:</b> ${trip.trip_identifier}\n`
      message += `🚗 <b>Транспорт:</b> ${trip.vehicle_number}\n`

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

      message += `⏰ <b>Плановое время погрузки:</b> ${formattedDate} ${formattedTime}\n`

      if (trip.driver_comment) {
        message += `💬 <b>Комментарий:</b> ${trip.driver_comment}\n`
      }

      message += `\n📍 <b>Маршрут:</b>\n`

      // Объединяем все точки и сортируем по point_num
      const allPoints = [
        ...trip.loading_points.map((p) => ({ ...p, type: "P" })),
        ...trip.unloading_points.map((p) => ({ ...p, type: "D" })),
      ]

      // Сортируем по point_num
      allPoints.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Выводим все точки в едином списке
      allPoints.forEach((point, index) => {
        const pointNumber = index + 1
        const pointType = point.type === "P" ? "Погрузка" : "Разгрузка"
        const pointIcon = point.type === "P" ? "📦" : "📤"

        message += `${pointNumber}) ${pointIcon} ${point.point_id} ${point.point_name} (${pointType})\n`

        if (point.adress) {
          message += `    ${point.adress}\n`
        }

        // Добавляем окна приемки для точек разгрузки
        if (point.type === "D") {
          const doorTimes = []
          if (point.door_open_1) doorTimes.push(point.door_open_1)
          if (point.door_open_2) doorTimes.push(point.door_open_2)
          if (point.door_open_3) doorTimes.push(point.door_open_3)

          if (doorTimes.length > 0) {
            message += `    Окна приемки: ${doorTimes.join(" | ")}\n`
          }
        }
      })

      // Добавляем ссылку на маршрут если возможно
      const routeUrl = buildRouteUrl(trip)
      if (routeUrl) {
        message += `\n🗺️ <a href="${routeUrl}">Построить маршрут</a>\n`
      }

      message += `\n`
    })

    message += `Пожалуйста, подтвердите или отклоните заявки:`

    console.log("Generated message:", message)

    // Создаем кнопки
    const keyboard = {
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
        [
          {
            text: "🚫 Отказаться",
            callback_data: `decline_${messageId}`,
          },
        ],
      ],
    }

    // Отправляем сообщение
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
        reply_markup: keyboard,
        disable_web_page_preview: false,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      console.error("Telegram API error:", result)
      throw new Error(`Telegram API error: ${result.description}`)
    }

    console.log(`Message sent successfully. Message ID: ${result.result.message_id}`)

    return {
      message_id: result.result.message_id,
      messageText: message,
    }
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

export async function sendTelegramMessage(chatId: number, text: string) {
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

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error sending telegram message:", error)
    throw error
  }
}

export async function editTelegramMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
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

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error editing telegram message:", error)
    throw error
  }
}

export async function deleteTelegramMessage(chatId: number, messageId: number) {
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

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error deleting telegram message:", error)
    throw error
  }
}

export async function sendTripMessageWithButtons(
  telegramId: number,
  tripData: TripData,
  driverName: string,
  messageId: number,
  isCorrection = false,
  isResend = false,
  previousTelegramMessageId?: number | null,
): Promise<{ message_id: number; messageText: string }> {
  return sendMultipleTripMessageWithButtons(
    telegramId,
    [tripData],
    driverName,
    messageId,
    isCorrection,
    isResend,
    previousTelegramMessageId,
  )
}
