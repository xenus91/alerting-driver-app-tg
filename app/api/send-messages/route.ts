import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  createTrip,
  createTripMessage,
  createTripPoint,
  getUserByPhone,
  getAllPoints,
  updateMessageStatus,
  type Point,
} from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Получаем информацию о текущем пользователе
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get("session_token")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Получаем данные текущего пользователя из сессии
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const currentUserResult = await sql`
      SELECT u.id, u.telegram_id, u.phone, u.name, u.first_name, u.last_name, u.full_name, u.carpark, u.role
      FROM users u
      JOIN user_sessions us ON u.id = us.user_id
      WHERE us.session_token = ${sessionCookie.value} AND us.expires_at > NOW()
      LIMIT 1
    `

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: "Сессия не найдена или истекла" }, { status: 401 })
    }

    const currentUser = currentUserResult[0]
    console.log(`=== SEND MESSAGES API CALLED BY USER ===`)
    console.log(`Current user:`, {
      id: currentUser.id,
      name: currentUser.first_name || currentUser.name,
      carpark: currentUser.carpark,
      role: currentUser.role,
    })

    const body = await request.json()
    console.log(`Received body:`, JSON.stringify(body, null, 2))

    // Проверяем, какой формат данных мы получили
    if (body.tripId) {
      // Новый формат - отправка существующих сообщений по tripId
      return await sendExistingMessages(body.tripId, sql)
    } else {
      // Старый формат - отправка из загруженных данных
      const tripData = body.tripData || body.campaignId

      if (!tripData || !Array.isArray(tripData) || tripData.length === 0) {
        console.error("No trip data found in request")
        return NextResponse.json({ error: "Данные рейсов не найдены" }, { status: 400 })
      }

      return await sendFromUploadedData(tripData, currentUser, sql)
    }
  } catch (error) {
    console.error("Send messages error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при отправке сообщений",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

/* === НОВАЯ ФУНКЦИЯ ===
 * Добавлена функция generateMessageText для формирования текста сообщения до создания записи в базе данных.
 * Это устраняет ошибку NOT NULL для столбца message в таблице trip_messages.
 * Логика формирования текста перенесена из sendFromUploadedData для идентичности с предыдущей реализацией.
 */
function generateMessageText(trips: any[], firstName: string): string {
  let message = `🌅 <b>Доброго времени суток!</b>\n\n`
  message += `👤 Уважаемый, <b>${firstName}</b>\n\n`

  const isMultiple = trips.length > 1
  message += `🚛 На Вас запланирован${isMultiple ? "ы" : ""} <b>${trips.length} рейс${trips.length > 1 ? "а" : ""}:</b>\n\n`

  const sortedTrips = [...trips].sort((a, b) => {
    const timeA = new Date(a.planned_loading_time || "").getTime()
    const timeB = new Date(b.planned_loading_time || "").getTime()
    return timeA - timeB
  })

  sortedTrips.forEach((trip, tripIndex) => {
    console.log(`Processing trip ${tripIndex + 1}: ${trip.trip_identifier}`)

    message += `<b>Рейс ${tripIndex + 1}:</b>\n`
    message += `Транспортировка: <b>${trip.trip_identifier}</b>\n`
    message += `🚗 Транспорт: <b>${trip.vehicle_number}</b>\n`

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

    if (trip.loading_points.length > 0) {
      message += `📦 <b>Погрузка:</b>\n`
      trip.loading_points.forEach((point: any, index: number) => {
        message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>\n`
      })
      message += `\n`
    }

    if (trip.unloading_points.length > 0) {
      message += `📤 <b>Разгрузка:</b>\n`
      trip.unloading_points.forEach((point: any, index: number) => {
        message += `${index + 1}) <b>${point.point_id} ${point.point_name}</b>\n`

        const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter((w) => w && w.trim())
        if (windows.length > 0) {
          message += `   🕐 Окна приемки: <code>${windows.join(" | ")}</code>\n`
        }
      })
      message += `\n`
    }

    if (trip.driver_comment && trip.driver_comment.trim()) {
      message += `💬 <b>Комментарий по рейсу:</b>\n<i>${trip.driver_comment}</i>\n\n`
    }

    const routePoints = [...trip.loading_points, ...trip.unloading_points]
    console.log(
      `Route points for trip ${trip.trip_identifier}:`,
      routePoints.map((p: any) => ({ id: p.point_id, lat: p.latitude, lng: p.longitude })),
    )

    const validPoints = routePoints.filter((p: any) => {
      const lat = typeof p.latitude === "string" ? Number.parseFloat(p.latitude) : p.latitude
      const lng = typeof p.longitude === "string" ? Number.parseFloat(p.longitude) : p.longitude
      return lat && lng && !isNaN(lat) && !isNaN(lng)
    })

    let routeUrl = null
    if (validPoints.length >= 2) {
      const coordinates = validPoints
        .map((p: any) => {
          const lat = typeof p.latitude === "string" ? Number.parseFloat(p.latitude) : p.latitude
          const lng = typeof p.longitude === "string" ? Number.parseFloat(p.longitude) : p.longitude
          return `${lat},${lng}`
        })
        .join("~")

      routeUrl = `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`
      console.log(`Built route URL: ${routeUrl}`)
    } else {
      console.log(`No route URL generated for trip ${trip.trip_identifier} - insufficient coordinates`)
    }

    if (routeUrl) {
      message += `🗺️ <a href="${routeUrl}">Построить маршрут</a>\n\n`
      console.log(`Added route URL for trip ${trip.trip_identifier}`)
    }

    if (tripIndex < sortedTrips.length - 1) {
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    }
  })

  message += `🙏 <b>Просьба подтвердить рейс${isMultiple ? "ы" : ""}</b>`

  console.log(`Final message length: ${message.length}`)
  console.log(`Message preview: ${message.substring(0, 200)}...`)

  return message
}
/* === КОНЕЦ НОВОЙ ФУНКЦИИ === */

/* === ИЗМЕНЁННАЯ ФУНКЦИЯ ===
 * Функция sendExistingMessages обновлена для совместимости с последней сигнатурой sendMultipleTripMessageWithButtons.
 * Добавлены параметры isCorrection, isResend и prevMessageId, чтобы соответствовать вызову в sendFromUploadedData.
 * Сохранено обновление message в базе данных через updateMessageStatus.
 */
async function sendExistingMessages(tripId: number, sql: any) {
  console.log(`=== SENDING EXISTING MESSAGES FOR TRIP ${tripId} ===`)

  // Получаем все неотправленные сообщения для этого рейса
  const pendingMessages = await sql`
    SELECT tm.*, u.telegram_id, u.first_name, u.full_name
    FROM trip_messages tm
    LEFT JOIN users u ON tm.telegram_id = u.telegram_id
    WHERE tm.trip_id = ${tripId} AND tm.status = 'pending'
    ORDER BY tm.phone, tm.trip_identifier
  `

  console.log(`Found ${pendingMessages.length} pending messages`)

  if (pendingMessages.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No pending messages to send",
      sent: 0,
      errors: 0,
    })
  }

  // Группируем сообщения по телефону
  const messagesByPhone = new Map()

  for (const message of pendingMessages) {
    if (!message.telegram_id) {
      console.log(`Skipping message ${message.id} - no telegram_id`)
      await updateMessageStatus(message.id, "error", "User not found in Telegram", null, null)
      continue
    }

    if (!messagesByPhone.has(message.phone)) {
      messagesByPhone.set(message.phone, [])
    }
    messagesByPhone.get(message.phone).push(message)
  }

  console.log(`Grouped messages by ${messagesByPhone.size} phones`)

  let sentCount = 0
  let errorCount = 0

  // Отправляем сообщения для каждого телефона
  for (const [phone, messages] of messagesByPhone) {
    try {
      console.log(`Processing ${messages.length} messages for phone ${phone}`)

      const user = messages[0]
      const messageIds = messages.map((m: any) => m.id)

      // Получаем уникальные рейсы для этого телефона
      const uniqueTrips = new Map()
      for (const message of messages) {
        if (!uniqueTrips.has(message.trip_identifier)) {
          uniqueTrips.set(message.trip_identifier, message)
        }
      }

      const tripsArray = Array.from(uniqueTrips.values())
      console.log(`Found ${tripsArray.length} unique trips for phone ${phone}`)

      // Получаем точки для всех рейсов
      const tripsData = []
      for (const trip of tripsArray) {
        const pointsResult = await sql`
          SELECT 
            tp.*, 
            p.point_name, 
            p.point_id as point_short_id, 
            p.door_open_1, 
            p.door_open_2, 
            p.door_open_3,
            p.latitude,
            p.longitude
          FROM trip_points tp
          JOIN points p ON tp.point_id = p.id
          WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${trip.trip_identifier}
          ORDER BY tp.point_type DESC, tp.point_num
        `

        const loading_points = []
        const unloading_points = []

        for (const point of pointsResult) {
          const pointInfo = {
            point_id: point.point_short_id,
            point_name: point.point_name,
            door_open_1: point.door_open_1,
            door_open_2: point.door_open_2,
            door_open_3: point.door_open_3,
            latitude: point.latitude,
            longitude: point.longitude,
          }

          if (point.point_type === "P") {
            loading_points.push(pointInfo)
          } else if (point.point_type === "D") {
            unloading_points.push(pointInfo)
          }
        }

        tripsData.push({
          trip_identifier: trip.trip_identifier,
          vehicle_number: trip.vehicle_number,
          planned_loading_time: trip.planned_loading_time,
          driver_comment: trip.driver_comment,
          loading_points: loading_points,
          unloading_points: unloading_points,
        })
      }

      console.log(`Sending message for ${tripsData.length} trips`)

      const telegramResult = await sendMultipleTripMessageWithButtons(
        Number(user.telegram_id),
        tripsData,
        user.first_name || "Водитель",
        messageIds[0],
        false, // isCorrection
        false, // isResend
        null // prevMessageId
      )

      for (const messageId of messageIds) {
        await updateMessageStatus(
          messageId,
          "sent",
          undefined,
          telegramResult.message_id,
          telegramResult.messageText
        )
      }
      sentCount += messageIds.length

      console.log(`Successfully sent messages for phone ${phone}`)
    } catch (error) {
      console.error(`Error sending messages for phone ${phone}:`, error)

      for (const message of messages) {
        await updateMessageStatus(
          message.id,
          "error",
          error instanceof Error ? error.message : "Unknown error",
          null,
          null
        )
      }
      errorCount += messages.length
    }
  }

  console.log(`=== SENDING COMPLETED ===`)
  console.log(`Sent: ${sentCount}, Errors: ${errorCount}`)

  return NextResponse.json({
    success: true,
    message: `Messages processed: ${sentCount} sent, ${errorCount} errors`,
    sent: sentCount,
    errors: errorCount,
  })
}
/* === КОНЕЦ ИЗМЕНЁННОЙ ФУНКЦИИ === */

/* === ИЗМЕНЁННАЯ ФУНКЦИЯ ===
 * Функция sendFromUploadedData переработана для устранения ошибки NOT NULL.
 * Текст сообщения формируется до создания записей в trip_messages с помощью generateMessageText.
 * Текст передаётся в createTripMessage, чтобы столбец message был заполнен.
 * Добавлены параметры isCorrection, isResend и prevMessageId в вызов sendMultipleTripMessageWithButtons.
 * Сохранена логика отправки одного сообщения и обновления всех записей после отправки.
 */
async function sendFromUploadedData(tripData: any[], currentUser: any, sql: any) {
  console.log(`Processing ${tripData.length} trips for sending`)

  const mainTrip = await createTrip(currentUser.carpark)
  console.log(`Created main trip with ID: ${mainTrip.id} and carpark: ${currentUser.carpark}`)

  const allPoints = await getAllPoints()
  console.log(`Found ${allPoints.length} points in database`)

  const pointsMap = new Map<string, Point>()
  for (const point of allPoints) {
    pointsMap.set(point.point_id, point)
  }

  const phoneGroups = new Map<string, any[]>()

  for (const tripDataItem of tripData) {
    const phone = tripDataItem.phone
    if (!phoneGroups.has(phone)) {
      phoneGroups.set(phone, [])
    }
    phoneGroups.get(phone)!.push(tripDataItem)
  }

  console.log(`Grouped trips into ${phoneGroups.size} phone groups`)

  const results = {
    total: 0,
    sent: 0,
    errors: 0,
    details: [] as any[],
  }

  for (const [phone, phoneTrips] of phoneGroups) {
    try {
      results.total++

      console.log(`Processing ${phoneTrips.length} trips for phone: ${phone}`)

      const user = await getUserByPhone(phone)
      if (!user) {
        console.log(`User not found for phone: ${phone}`)
        results.errors++
        results.details.push({
          phone: phone,
          status: "error",
          error: "Пользователь не найден",
        })
        continue
      }

      if (user.verified === false) {
        console.log(`User not verified for phone: ${phone}`)
        results.errors++
        results.details.push({
          phone: phone,
          status: "error",
          error: "Пользователь не верифицирован",
        })
        continue
      }

      console.log(`Processing trips for user: ${user.first_name || user.name}`)

      // Подготавливаем данные для отправки
      const tripsForSending = phoneTrips.map((tripDataItem) => {
        const loadingPointsData = []
        const unloadingPointsData = []

        for (const loadingPoint of tripDataItem.loading_points || []) {
          const point = pointsMap.get(loadingPoint.point_id)
          if (point) {
            loadingPointsData.push({
              point_id: point.point_id,
              point_name: point.point_name,
              point_num: loadingPoint.point_num,
              door_open_1: point.door_open_1,
              door_open_2: point.door_open_2,
              door_open_3: point.door_open_3,
              latitude: point.latitude,
              longitude: point.longitude,
            })
          }
        }

        for (const unloadingPoint of tripDataItem.unloading_points || []) {
          const point = pointsMap.get(unloadingPoint.point_id)
          if (point) {
            unloadingPointsData.push({
              point_id: point.point_id,
              point_name: point.point_name,
              point_num: unloadingPoint.point_num,
              door_open_1: point.door_open_1,
              door_open_2: point.door_open_2,
              door_open_3: point.door_open_3,
              latitude: point.latitude,
              longitude: point.longitude,
            })
          }
        }

        return {
          trip_identifier: tripDataItem.trip_identifier,
          vehicle_number: tripDataItem.vehicle_number,
          planned_loading_time: tripDataItem.planned_loading_time,
          driver_comment: tripDataItem.driver_comment,
          loading_points: loadingPointsData,
          unloading_points: unloadingPointsData,
        }
      })

      const firstName = user.first_name || user.full_name || "Водитель"

      // Формируем текст сообщения до создания записей в базе
      const messageText = generateMessageText(tripsForSending, firstName)
      console.log(`Generated message text length: ${messageText.length}`)
      console.log(`Message preview: ${messageText.substring(0, 200)}...`)

      // Создаем записи в БД для всех рейсов этого пользователя
      const messageIds: number[] = []
      for (const tripDataItem of phoneTrips) {
        // Создаем пункты для этого рейса
        for (const loadingPoint of tripDataItem.loading_points || []) {
          const point = pointsMap.get(loadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${loadingPoint.point_id}`)
            continue
          }

          await createTripPoint(
            mainTrip.id,
            loadingPoint.point_id,
            "P",
            loadingPoint.point_num,
            tripDataItem.trip_identifier,
            phone // Номер водителя
          )
          console.log(`Created loading point: ${loadingPoint.point_id}`)
        }

        for (const unloadingPoint of tripDataItem.unloading_points || []) {
          const point = pointsMap.get(unloadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${unloadingPoint.point_id}`)
            continue
          }

          await createTripPoint(
            mainTrip.id,
            unloadingPoint.point_id,
            "D",
            unloadingPoint.point_num,
            tripDataItem.trip_identifier,
            phone // Номер водителя
          )
          console.log(`Created unloading point: ${unloadingPoint.point_id}`)
        }

        // Создаем сообщение с текстом
        const message = await createTripMessage(
          mainTrip.id,
          tripDataItem.phone,
          messageText,
          user.telegram_id,
          {
            trip_identifier: tripDataItem.trip_identifier,
            vehicle_number: tripDataItem.vehicle_number,
            planned_loading_time: tripDataItem.planned_loading_time,
            driver_comment: tripDataItem.driver_comment,
          },
        )
        messageIds.push(message.id)
        console.log(`Created trip message for trip ${tripDataItem.trip_identifier}`)
      }

      // Отправляем ОДНО сообщение со всеми рейсами
      const telegramResult = await sendMultipleTripMessageWithButtons(
        Number(user.telegram_id),
        tripsForSending,
        firstName,
        messageIds[0],
        false, // isCorrection
        false, // isResend
        null // prevMessageId
      )

      // Обновляем статус ВСЕХ сообщений для этого пользователя
      await sql`
        UPDATE trip_messages 
        SET status = 'sent', 
            sent_at = ${new Date().toISOString()},
            telegram_message_id = ${telegramResult.message_id},
            message = ${telegramResult.messageText}
        WHERE trip_id = ${mainTrip.id} AND phone = ${phone}
      `

      console.log(`Updated message status to 'sent' for phone: ${phone}`)

      results.sent++
      results.details.push({
        phone: phone,
        status: "sent",
        user_name: firstName,
        trips_count: phoneTrips.length,
        telegram_message_id: telegramResult.message_id,
      })

      console.log(`Messages sent successfully to ${phone}`)
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : "Ошибка отправки"
      console.error(`Failed to send message to ${phone}:`, sendError)

      try {
        await sql`
          UPDATE trip_messages 
          SET status = 'error', 
              error_message = ${errorMessage}
          WHERE trip_id = ${mainTrip.id} AND phone = ${phone}
        `
      } catch (updateError) {
        console.error("Error updating message status to error:", updateError)
      }

      results.errors++
      results.details.push({
        phone: phone,
        status: "error",
        error: errorMessage,
      })
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`=== MESSAGE SENDING COMPLETE ===`)
  console.log(`Total: ${results.total}, Sent: ${results.sent}, Errors: ${results.errors}`)
  console.log(`Trip created with carpark: ${currentUser.carpark}`)

  return NextResponse.json({
    success: true,
    tripId: mainTrip.id,
    carpark: currentUser.carpark,
    results,
  })
}
/* === КОНЕЦ ИЗМЕНЁННОЙ ФУНКЦИИ === */
