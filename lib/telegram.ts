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
    }>
    unloading_points: Array<{
      point_id: string
      point_name: string
      door_open_1?: string
      door_open_2?: string
      door_open_3?: string
      latitude?: number | string
      longitude?: number | string
    }>
  }>,
  firstName: string,
  messageId: number,
  isCorrection = false,
) {
  try {
    console.log(`=== SENDING MULTIPLE TRIP MESSAGE ===`)
    console.log(`Chat ID: ${chatId}, Trips count: ${trips.length}, Is correction: ${isCorrection}`)

    // Генерируем красивое сообщение
    let message = ""

    // Добавляем заголовок корректировки если нужно
    if (isCorrection) {
      message += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>

`
    }

    message += `🌅 <b>Доброго времени суток!</b>

`
    message += `👤 Уважаемый, <b>${firstName}</b>

`

    // Определяем множественное или единственное число
    const isMultiple = trips.length > 1
    message += `🚛 На Вас запланирован${isMultiple ? "ы" : ""} <b>${trips.length} рейс${trips.length > 1 ? "а" : ""}:</b>

`

    // Сортируем рейсы по времени погрузки
    const sortedTrips = [...trips].sort((a, b) => {
      const timeA = new Date(a.planned_loading_time || "").getTime()
      const timeB = new Date(b.planned_loading_time || "").getTime()
      return timeA - timeB
    })

    // Перебираем все рейсы
    sortedTrips.forEach((trip, tripIndex) => {
      console.log(`Processing trip ${tripIndex + 1}: ${trip.trip_identifier}`)

      message += `<b>Рейс ${tripIndex + 1}:</b>
`
      message += `Транспортировка: <b>${trip.trip_identifier}</b>
`
      message += `🚗 Транспорт: <b>${trip.vehicle_number}</b>
`

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

      message += `⏰ Плановое время погрузки: <b>${formatDateTime(trip.planned_loading_time)}</b>

`

      // Пункты погрузки
      if (trip.loading_points.length > 0) {
        message += `📦 <b>Погрузка:</b>
`
        trip.loading_points.forEach((point, index) => {
          message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>
`
        })
        message += `
`
      }

      // Пункты разгрузки
      if (trip.unloading_points.length > 0) {
        message += `📤 <b>Разгрузка:</b>
`
        trip.unloading_points.forEach((point, index) => {
          message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>
`

          // Окна приемки для пункта разгрузки
          const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
          if (windows.length > 0) {
            message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>
`
          }
        })
        message += `
`
      }

      // Комментарий
      if (trip.driver_comment && trip.driver_comment.trim()) {
        message += `💬 <b>Комментарий по рейсу:</b>
<i>${trip.driver_comment}</i>

`
      }

      // Строим маршрут для этого рейса: сначала все точки погрузки, потом все точки разгрузки
      const routePoints = [...trip.loading_points, ...trip.unloading_points]
      console.log(
        `Route points for trip ${trip.trip_identifier}:`,
        routePoints.map((p) => ({ id: p.point_id, lat: p.latitude, lng: p.longitude })),
      )

      const routeUrl = buildRouteUrl(routePoints)

      if (routeUrl) {
        message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>

`
        console.log(`Added route URL for trip ${trip.trip_identifier}`)
      } else {
        console.log(`No route URL generated for trip ${trip.trip_identifier} - insufficient coordinates`)
      }

      // Добавляем разделитель между рейсами (кроме последнего)
      if (tripIndex < sortedTrips.length - 1) {
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
      }
    })

    message += `🙏 <b>Просьба подтвердить рейс${isMultiple ? "ы" : ""}</b>`

    console.log(`Final message length: ${message.length}`)
    console.log(`Message preview: ${message.substring(0, 200)}...`)

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
    return data.result
  } catch (error) {
    console.error("Error sending multiple trip message with buttons:", error)
    throw error
  }
}
