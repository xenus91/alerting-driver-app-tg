import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

interface TelegramMessage {
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

interface TelegramCallbackQuery {
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

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

// НОВАЯ ФУНКЦИЯ: Отправка реплая на сообщение
async function sendReplyToMessage(chatId: number, replyToMessageId: number, text: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_to_message_id: replyToMessageId
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
    // Если не получилось отправить реплай, отправляем обычное сообщение
    await sendMessage(chatId, text)
    throw error
  }
}

async function sendMessage(chatId: number, text: string) {
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

async function sendMessageWithButtons(
  chatId: number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

  console.log("=== SENDING MESSAGE WITH BUTTONS ===")
  console.log("Chat ID:", chatId)
  console.log("Text:", text)
  console.log("Buttons:", JSON.stringify(buttons, null, 2))

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    }

    console.log("Full payload:", JSON.stringify(payload, null, 2))

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log("Telegram API response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      throw new Error(data.description || "Failed to send message with buttons")
    }

    console.log("=== BUTTONS MESSAGE SENT SUCCESSFULLY ===")
    return data.result
  } catch (error) {
    console.error("Error sending Telegram message with buttons:", error)
    throw error
  }
}

async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup?: any) {
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
      // Не бросаем ошибку, просто логируем
      return null
    }

    console.log("=== MESSAGE REPLY MARKUP EDITED SUCCESSFULLY ===")
    return data.result
  } catch (error) {
    console.error("Error editing message reply markup:", error)
    // Не бросаем ошибку, просто логируем
    return null
  }
}

async function sendContactRequest(chatId: number) {
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

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

  console.log("=== ANSWERING CALLBACK QUERY ===")
  console.log("Callback Query ID:", callbackQueryId)
  console.log("Answer text:", text)

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
    console.log("answerCallbackQuery response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      console.error("Failed to answer callback query:", data.description)
      // Не бросаем ошибку для старых callback query
      return null
    }

    console.log("=== CALLBACK QUERY ANSWERED ===")
    return data.result
  } catch (error) {
    console.error("Error answering callback query:", error)
    // Не бросаем ошибку для старых callback query
    return null
  }
}

async function createUser(telegramId: number, phone: string, name: string) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    console.log(`Creating user: telegramId=${telegramId}, phone=${normalizedPhone}, name=${name}`)

    const result = await sql`
      INSERT INTO users (telegram_id, phone, name, registration_state)
      VALUES (${telegramId}, ${normalizedPhone}, ${name}, 'awaiting_first_name')
      ON CONFLICT (telegram_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        name = EXCLUDED.name,
        registration_state = 'awaiting_first_name'
      RETURNING *
    `

    console.log("User created/updated:", result[0])
    return result[0]
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

async function getUserByTelegramId(telegramId: number) {
  try {
    const result = await sql`
      SELECT * FROM users WHERE telegram_id = ${telegramId}
    `
    console.log(`User found for telegram_id ${telegramId}:`, result[0] || "not found")
    return result[0]
  } catch (error) {
    console.error("Error getting user by telegram id:", error)
    throw error
  }
}

async function updateUserRegistrationStep(telegramId: number, step: string, data?: any) {
  try {
    console.log(`Updating registration step for user ${telegramId}: ${step} = ${data}`)

    let updateQuery

    switch (step) {
      case "first_name":
        updateQuery = sql`
          UPDATE users 
          SET temp_first_name = ${data}, registration_state = 'awaiting_last_name'
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `
        break
      case "last_name":
        updateQuery = sql`
          UPDATE users 
          SET temp_last_name = ${data}, registration_state = 'awaiting_carpark'
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `
        break
      case "carpark":
        updateQuery = sql`
          UPDATE users 
          SET carpark = ${data}, 
              first_name = temp_first_name,
              last_name = temp_last_name,
              full_name = temp_first_name || ' ' || temp_last_name,
              registration_state = 'completed',
              temp_first_name = NULL,
              temp_last_name = NULL
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `
        break
      default:
        throw new Error(`Unknown registration step: ${step}`)
    }

    const result = await updateQuery
    console.log(`User registration step updated:`, result[0])
    return result[0]
  } catch (error) {
    console.error("Error updating user registration step:", error)
    throw error
  }
}

async function setUserPendingAction(userId: number, actionType: string, relatedMessageId?: number, actionData?: any) {
  try {
    const dataString = actionData ? JSON.stringify(actionData) : null
    console.log(
      `Setting pending action for user ${userId}: ${actionType}, messageId: ${relatedMessageId}, data: ${dataString}`,
    )

    const result = await sql`
      INSERT INTO user_pending_actions (user_id, action_type, related_message_id, action_data)
      VALUES (${userId}, ${actionType}, ${relatedMessageId || null}, ${dataString})
      ON CONFLICT (user_id) DO UPDATE SET
        action_type = EXCLUDED.action_type,
        related_message_id = EXCLUDED.related_message_id,
        action_data = EXCLUDED.action_data,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    console.log(`Pending action set for user ${userId}:`, result[0])
    return result[0]
  } catch (error) {
    console.error("Error setting user pending action:", error)
    throw error
  }
}

async function getUserPendingAction(userId: number) {
  try {
    const result = await sql`
      SELECT * FROM user_pending_actions WHERE user_id = ${userId}
    `
    console.log(`Pending action for user ${userId}:`, result[0] || "not found")
    return result[0]
  } catch (error) {
    console.error("Error getting user pending action:", error)
    throw error
  }
}

async function deleteUserPendingAction(userId: number) {
  try {
    await sql`
      DELETE FROM user_pending_actions WHERE user_id = ${userId}
    `
    console.log(`Pending action deleted for user ${userId}`)
  } catch (error) {
    console.error("Error deleting user pending action:", error)
    throw error
  }
}

async function getAllPoints() {
  try {
    const result = await sql`
      SELECT point_id, point_name, latitude, longitude 
      FROM points 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY point_id ASC
    `
    return result
  } catch (error) {
    console.error("Error getting all points:", error)
    throw error
  }
}

function buildRouteUrl(points: Array<{ latitude: string; longitude: string }>) {
  if (points.length < 2) {
    return null
  }

  const coordinates = points.map((p) => `${p.latitude},${p.longitude}`).join("~")

  return `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`=== TELEGRAM WEBHOOK RECEIVED at ${timestamp} ===`)

  try {
    const update: TelegramUpdate = await request.json()
    console.log("=== FULL TELEGRAM UPDATE ===")
    console.log(JSON.stringify(update, null, 2))

    // Обработка callback query (нажатие кнопок) - ПРИОРИТЕТ!
    if (update.callback_query) {
      console.log("=== PROCESSING CALLBACK QUERY ===")
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const messageId = callbackQuery.message?.message_id
      const userId = callbackQuery.from.id
      const data = callbackQuery.data

      console.log(`Callback query from user ${userId}: ${data}`)
      console.log("Chat ID:", chatId)
      console.log("Message ID:", messageId)

      if (!chatId) {
        console.log("❌ No chat ID in callback query")
        return NextResponse.json({ ok: true, status: "no_chat_id" })
      }

      // Обработка выбора точки для маршрута
      if (data?.startsWith("route_point_")) {
        const pointId = data.replace("route_point_", "")
        console.log(`🗺️ User ${userId} selected route point: ${pointId}`)

        try {
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }

          const pendingAction = await getUserPendingAction(user.id)

          // Получаем информацию о выбранной точке
          const pointResult = await sql`
            SELECT point_id, point_name, latitude, longitude 
            FROM points 
            WHERE point_id = ${pointId}
            LIMIT 1
          `

          if (pointResult.length === 0) {
            throw new Error("Point not found")
          }

          const selectedPoint = pointResult[0]

          let routePoints = []
          let stepMessage = ""

          if (pendingAction?.action_type === "building_route_start") {
            // Первая точка выбрана
            routePoints = [selectedPoint]
            stepMessage = `✅ Точка отправления: <b>${selectedPoint.point_id} ${selectedPoint.point_name}</b>\n\n🎯 Теперь выберите точку назначения:`

            await setUserPendingAction(user.id, "building_route_continue", null, { points: routePoints })
          } else if (pendingAction?.action_type === "building_route_continue") {
            // Добавляем следующую точку
            const existingData = pendingAction.action_data ? JSON.parse(pendingAction.action_data) : { points: [] }
            routePoints = [...existingData.points, selectedPoint]

            stepMessage = `🗺️ <b>Маршрут строится:</b>\n\n`
            routePoints.forEach((point, index) => {
              const emoji = index === 0 ? "🚀" : index === routePoints.length - 1 ? "🏁" : "📍"
              stepMessage += `${emoji} ${index + 1}. ${point.point_id} ${point.point_name}\n`
            })

            if (routePoints.length >= 2) {
              stepMessage += `\n💡 Выберите следующую точку или завершите построение маршрута:`
            } else {
              stepMessage += `\n🎯 Выберите следующую точку:`
            }

            await setUserPendingAction(user.id, "building_route_continue", null, { points: routePoints })
          }

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, `Добавлена точка: ${selectedPoint.point_name}`)

          // Скрываем кнопки предыдущего сообщения
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }

          // Получаем все доступные точки для следующего выбора
          const allPoints = await getAllPoints()

          // Исключаем уже выбранные точки
          const selectedPointIds = routePoints.map((p) => p.point_id)
          const availablePoints = allPoints.filter((p) => !selectedPointIds.includes(p.point_id))

          // Формируем кнопки
          const buttons = []

          // Кнопки управления ВВЕРХУ
          const controlButtons = []

          // Кнопка "Завершить" если уже есть минимум 2 точки
          if (routePoints.length >= 2) {
            controlButtons.push({
              text: "✅ Завершить построение маршрута",
              callback_data: "route_finish",
            })
          }

          // Кнопка отмены
          controlButtons.push({
            text: "❌ Отменить",
            callback_data: "route_cancel",
          })

          // Добавляем кнопки управления в первый ряд
          buttons.push(controlButtons)

          // Кнопки с точками (по 2 в ряд) ВНИЗУ
          for (let i = 0; i < availablePoints.length; i += 2) {
            const row = []
            row.push({
              text: `${availablePoints[i].point_id} ${availablePoints[i].point_name}`,
              callback_data: `route_point_${availablePoints[i].point_id}`,
            })
            if (i + 1 < availablePoints.length) {
              row.push({
                text: `${availablePoints[i + 1].point_id} ${availablePoints[i + 1].point_name}`,
                callback_data: `route_point_${availablePoints[i + 1].point_id}`,
              })
            }
            buttons.push(row)
          }

          await sendMessageWithButtons(chatId, stepMessage, buttons)

          console.log("=== ROUTE POINT SELECTED ===")

          return NextResponse.json({
            ok: true,
            status: "route_point_selected",
            point_id: pointId,
            total_points: routePoints.length,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing route point selection:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при выборе точки маршрута.")

          return NextResponse.json({
            ok: true,
            status: "route_point_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      // Обработка завершения построения маршрута
      if (data === "route_finish") {
        console.log(`🏁 User ${userId} finishing route building`)

        try {
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }

          const pendingAction = await getUserPendingAction(user.id)
          if (!pendingAction || pendingAction.action_type !== "building_route_continue") {
            throw new Error("No route building in progress")
          }

          const routeData = JSON.parse(pendingAction.action_data)
          const routePoints = routeData.points

          if (routePoints.length < 2) {
            throw new Error("Not enough points for route")
          }

          // Строим URL маршрута
          const routeUrl = buildRouteUrl(routePoints)

          if (!routeUrl) {
            throw new Error("Failed to build route URL")
          }

          // Формируем сообщение с маршрутом
          let routeMessage = `🗺️ <b>Маршрут построен!</b>\n\n`
          routeMessage += `📍 <b>Точки маршрута:</b>\n`

          routePoints.forEach((point, index) => {
            const emoji = index === 0 ? "🚀" : index === routePoints.length - 1 ? "🏁" : "📍"
            routeMessage += `${emoji} ${index + 1}. ${point.point_id} ${point.point_name}\n`
          })

          routeMessage += `\n🔗 <a href="${routeUrl}">Открыть маршрут в Яндекс.Картах</a>`

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, "Маршрут построен!")

          // Скрываем кнопки
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }

          // Отправляем готовый маршрут
          await sendMessage(chatId, routeMessage)

          // Удаляем pending action
          await deleteUserPendingAction(user.id)

          console.log("=== ROUTE FINISHED ===")

          return NextResponse.json({
            ok: true,
            status: "route_finished",
            points_count: routePoints.length,
            route_url: routeUrl,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error finishing route:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при построении маршрута.")

          return NextResponse.json({
            ok: true,
            status: "route_finish_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      // Обработка отмены построения маршрута
      if (data === "route_cancel") {
        console.log(`❌ User ${userId} cancelling route building`)

        try {
          const user = await getUserByTelegramId(userId)
          if (user) {
            await deleteUserPendingAction(user.id)
          }

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, "Построение маршрута отменено")

          // Скрываем кнопки
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }

          await sendMessage(chatId, "❌ Построение маршрута отменено.")

          return NextResponse.json({
            ok: true,
            status: "route_cancelled",
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error cancelling route:", error)
          return NextResponse.json({
            ok: true,
            status: "route_cancel_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      // Обработка выбора автопарка
      if (data?.startsWith("carpark_")) {
        const carpark = data.replace("carpark_", "")
        console.log(`🏢 User ${userId} selected carpark: ${carpark}`)

        try {
          // Сначала отвечаем на callback query (игнорируем ошибки старых запросов)
          await answerCallbackQuery(callbackQuery.id, `Выбран автопарк ${carpark}`)

          // Скрываем кнопки (убираем reply_markup)
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
            console.log("✅ Buttons hidden after carpark selection")
          }

          // Обновляем пользователя в базе
          const user = await updateUserRegistrationStep(userId, "carpark", carpark)
          console.log("✅ Registration completed for user:", user)

          // Отправляем финальное сообщение
          const completionMessage =
            `🎉 Отлично! Регистрация завершена.\n\n` +
            `👤 Уважаемый(ая) ${user.first_name}!\n\n` +
            `✅ Вы успешно зарегистрированы в системе уведомлений.\n\n` +
            `📱 Телефон: +${user.phone}\n` +
            `👤 ФИО: ${user.full_name}\n` +
            `🏢 Автопарк: ${carpark}\n\n` +
            `🚛 Теперь вы будете получать уведомления о предстоящих рейсах.\n` +
            `📋 Система будет присылать информацию о:\n` +
            `• Времени погрузки\n` +
            `• Маршруте следования\n` +
            `• Необходимых документах\n\n` +
            `❓ Если у вас есть вопросы, обратитесь к диспетчеру.`

          await sendMessage(chatId, completionMessage)

          console.log("=== USER REGISTRATION COMPLETED SUCCESSFULLY ===")

          return NextResponse.json({
            ok: true,
            status: "registration_completed",
            user_id: userId,
            carpark: carpark,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("❌ Error completing registration:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при завершении регистрации. Попробуйте еще раз.")

          return NextResponse.json({
            ok: true, // Возвращаем ok: true чтобы не блокировать webhook
            status: "registration_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      // НОВЫЙ БЛОК: Обработка подтверждения рейса с реплаем
      if (data?.startsWith("confirm_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing confirmation for message ${messageId}`)

        try {
          // Получаем информацию о сообщении
          const messageResult = await sql`
            SELECT 
              trip_id,
              phone,
              telegram_message_id
            FROM trip_messages 
            WHERE id = ${messageId}
            LIMIT 1
          `

          let phone, trip_id, telegramMessageId
          if (messageResult.length === 0) {
            console.log(`Message ${messageId} not found, trying to find by user telegram_id`)

            // Альтернативный поиск
            const userMessageResult = await sql`
              SELECT 
                trip_id,
                phone,
                telegram_message_id
              FROM trip_messages
              WHERE telegram_id = ${userId} AND response_status = 'pending'
              LIMIT 1
            `

            if (userMessageResult.length === 0) {
              throw new Error(`No pending messages found for user ${userId}`)
            }

            phone = userMessageResult[0].phone
            trip_id = userMessageResult[0].trip_id
            telegramMessageId = userMessageResult[0].telegram_message_id
          } else {
            phone = messageResult[0].phone
            trip_id = messageResult[0].trip_id
            telegramMessageId = messageResult[0].telegram_message_id
          }

          // Обновляем ВСЕ сообщения этого водителя
          const updateResult = await sql`
            UPDATE trip_messages 
            SET response_status = 'confirmed', 
                response_comment = NULL,
                response_at = ${new Date().toISOString()}
            WHERE phone = ${phone} AND trip_id = ${trip_id}
            RETURNING id
          `

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, "Спасибо! Рейс подтвержден!")

          // Скрываем кнопки
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] })
          }

          // Отправляем реплай на исходное сообщение
          await sendReplyToMessage(
            chatId, 
            telegramMessageId, 
            "✅ Рейс(ы) подтвержден(ы)\n\nСпасибо за ваш ответ!"
          );

          return NextResponse.json({ ok: true, status: "confirmed_processed" })
        } catch (error) {
          console.error("Error processing confirmation:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при обработке подтверждения.")
          return NextResponse.json({ ok: true, status: "confirmation_error" })
        }
      }

      // НОВЫЙ БЛОК: Обработка отклонения рейса с запросом причины
      if (data?.startsWith("reject_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing rejection for message ${messageId}`)

        try {
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }

          // Проверяем pending сообщения
          const pendingCheck = await sql`
            SELECT COUNT(*) as count
            FROM trip_messages 
            WHERE telegram_id = ${userId} AND response_status = 'pending'
          `

          if (pendingCheck[0].count === 0) {
            throw new Error("No pending messages found for this user")
          }

          // Устанавливаем pending action для ожидания причины
          await setUserPendingAction(
            user.id, 
            "awaiting_rejection_reason", 
            messageId, // сохраняем ID сообщения для связи
            { 
              chatId, 
              originalMessageId: callbackQuery.message?.message_id 
            }
          )

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, "Внесите комментарий")

          // Скрываем кнопки исходного сообщения
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] })
          }

          // Отправляем запрос причины
          await sendMessage(
            chatId,
            `📝 Пожалуйста, укажите причину отклонения рейса в ответ на это сообщение:`
          )

          return NextResponse.json({ ok: true, status: "awaiting_rejection_reason" })
        } catch (error) {
          console.error("Error processing rejection:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при обработке отклонения.")
          return NextResponse.json({ ok: true, status: "rejection_error" })
        }
      }

      console.log("❓ Unknown callback query data:", data)
      // Игнорируем неизвестные callback query без ошибок
      await answerCallbackQuery(callbackQuery.id, "Неизвестная команда")
      return NextResponse.json({ ok: true, status: "callback_ignored" })
    }

            // Обработка обычных сообщений (текст, контакты и т.д.)
        if (update.message) {
          const message = update.message;
          const chatId = message.chat.id;
          const userId = message.from.id;
          const messageText = message.text;

          console.log(`=== PROCESSING MESSAGE ===`);
          console.log(`User: ${userId} (${message.from.first_name})`);
          console.log(`Chat: ${chatId}`);
          console.log(`Text: "${messageText}"`);

          // Получаем информацию о пользователе
          const existingUser = await getUserByTelegramId(userId);

          // НОВЫЙ БЛОК: Обработка причины отклонения рейса
          if (existingUser && messageText) {
            const pendingAction = await getUserPendingAction(existingUser.id);
            
            if (pendingAction && pendingAction.action_type === "awaiting_rejection_reason") {
              console.log(`Processing rejection reason: "${messageText}"`);
              
              try {
                // Получаем данные из pending action
                const actionData = JSON.parse(pendingAction.action_data || "{}");
                const tripMessageId = pendingAction.related_message_id;
                const originalMessageId = actionData.originalMessageId;
                
                if (!tripMessageId) {
                  throw new Error("No trip message ID in pending action");
                }

                // Обновляем запись в базе данных
                const updateResult = await sql`
                  UPDATE trip_messages 
                  SET response_status = 'rejected', 
                      response_comment = ${messageText},
                      response_at = ${new Date().toISOString()}
                  WHERE id = ${tripMessageId}
                  RETURNING id
                `;

                console.log(`Updated ${updateResult.length} messages`);

                // Удаляем pending action
                await deleteUserPendingAction(existingUser.id);

                // Отправляем подтверждение с реплаем
                if (originalMessageId) {
                  await sendReplyToMessage(
                    chatId,
                    originalMessageId,
                    `❌ Рейс отклонен.\n\nПричина: ${messageText}\n\nСпасибо за ответ.`
                  );
                } else {
                  await sendMessage(
                    chatId,
                    `❌ Рейс отклонен.\n\nПричина: ${messageText}\n\nСпасибо за ответ.`
                  );
                }

                return NextResponse.json({ ok: true, status: "rejection_reason_processed" });
              } catch (error) {
                console.error("Error processing rejection reason:", error);
                await sendMessage(chatId, "❌ Произошла ошибка при сохранении причины отклонения.");
                return NextResponse.json({ ok: true, status: "rejection_reason_error" });
              }
            }
          }

          // Обработка команды /toroute
          if (messageText === "/toroute") {
            console.log("=== PROCESSING /TOROUTE COMMAND ===");

            try {
              // Очищаем любые pending actions при старте команды
              if (existingUser) {
                await deleteUserPendingAction(existingUser.id);
                console.log("Cleared pending actions for user on /toroute");
              }

              // Проверяем, зарегистрирован ли пользователь
              if (!existingUser || existingUser.registration_state !== "completed") {
                await sendMessage(
                  chatId,
                  "❌ Для использования команды /toroute необходимо сначала зарегистрироваться. Отправьте /start",
                );
                return NextResponse.json({
                  ok: true,
                  status: "user_not_registered",
                  timestamp: timestamp,
                });
              }

              // Получаем все доступные точки с координатами
              const allPoints = await getAllPoints();

              if (allPoints.length < 2) {
                await sendMessage(
                  chatId,
                  "❌ Недостаточно точек с координатами для построения маршрута. Обратитесь к администратору.",
                );
                return NextResponse.json({
                  ok: true,
                  status: "insufficient_points",
                  timestamp: timestamp,
                });
              }

              // Устанавливаем pending action для начала построения маршрута
              await setUserPendingAction(existingUser.id, "building_route_start", null, { points: [] });

              const welcomeMessage = `🗺️ <b>Построение маршрута</b>\n\n` + `📍 Выберите точку отправления из списка ниже:`;

              // Формируем кнопки с точками (по 2 в ряд)
              const buttons = [];

              for (let i = 0; i < allPoints.length; i += 2) {
                const row = [];
                row.push({
                  text: `${allPoints[i].point_id} ${allPoints[i].point_name}`,
                  callback_data: `route_point_${allPoints[i].point_id}`,
                });
                if (i + 1 < allPoints.length) {
                  row.push({
                    text: `${allPoints[i + 1].point_id} ${allPoints[i + 1].point_name}`,
                    callback_data: `route_point_${allPoints[i + 1].point_id}`,
                  });
                }
                buttons.push(row);
              }

              // Кнопка отмены
              buttons.push([
                {
                  text: "❌ Отменить",
                  callback_data: "route_cancel",
                },
              ]);

              await sendMessageWithButtons(chatId, welcomeMessage, buttons);

              console.log("=== /TOROUTE COMMAND PROCESSED SUCCESSFULLY ===");

              return NextResponse.json({
                ok: true,
                status: "toroute_started",
                available_points: allPoints.length,
                timestamp: timestamp,
                user_id: userId,
                chat_id: chatId,
              });
            } catch (error) {
              console.error("=== ERROR PROCESSING /TOROUTE ===", error);
              await sendMessage(chatId, "❌ Произошла ошибка при запуске построения маршрута.");
              return NextResponse.json({
                ok: true,
                status: "toroute_error",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: timestamp,
              });
            }
          }

          // Обработка команды /status
          if (messageText === "/status") {
            console.log("=== PROCESSING /STATUS COMMAND ===");

            try {
              if (!existingUser) {
                await sendMessage(chatId, "❌ Вы не зарегистрированы в системе.\n\n📱 Для регистрации отправьте /start");
                return NextResponse.json({
                  ok: true,
                  status: "user_not_found",
                  timestamp: timestamp,
                });
              }

              let statusMessage = `📊 <b>Ваш статус в системе:</b>\n\n`;
              statusMessage += `👤 <b>Пользователь:</b> ${existingUser.first_name || "Не указано"}\n`;
              statusMessage += `📱 <b>Телефон:</b> +${existingUser.phone}\n`;

              if (existingUser.registration_state === "completed") {
                statusMessage += `✅ <b>Статус:</b> Регистрация завершена\n`;
                statusMessage += `👤 <b>ФИО:</b> ${existingUser.full_name}\n`;
                statusMessage += `🏢 <b>Автопарк:</b> ${existingUser.carpark}\n\n`;
                statusMessage += `🚛 Вы получаете уведомления о рейсах`;
              } else {
                statusMessage += `⏳ <b>Статус:</b> Регистрация не завершена\n`;
                statusMessage += `📝 <b>Этап:</b> ${existingUser.registration_state}\n\n`;
                statusMessage += `💡 Для завершения регистрации отправьте /start`;
              }

              await sendMessage(chatId, statusMessage);

              return NextResponse.json({
                ok: true,
                status: "status_sent",
                registration_state: existingUser.registration_state,
                timestamp: timestamp,
              });
            } catch (error) {
              console.error("Error processing /status:", error);
              await sendMessage(chatId, "❌ Произошла ошибка при получении статуса.");
              return NextResponse.json({
                ok: true,
                status: "status_error",
                timestamp: timestamp,
              });
            }
          }

          // Обработка команды /help
          if (messageText === "/help") {
            console.log("=== PROCESSING /HELP COMMAND ===");

            try {
              let helpMessage = `❓ <b>Справка по использованию бота</b>\n\n`;
              helpMessage += `🤖 <b>Этот бот предназначен для:</b>\n`;
              helpMessage += `• Получения уведомлений о рейсах\n`;
              helpMessage += `• Подтверждения/отклонения рейсов\n`;
              helpMessage += `• Построения маршрутов между точками\n\n`;

              helpMessage += `📋 <b>Доступные команды:</b>\n`;
              helpMessage += `🚀 /start - Начать работу и регистрацию\n`;
              helpMessage += `🗺️ /toroute - Построить маршрут между точками\n`;
              helpMessage += `📊 /status - Проверить статус регистрации\n`;
              helpMessage += `❓ /help - Показать эту справку\n\n`;

              if (existingUser && existingUser.registration_state === "completed") {
                helpMessage += `✅ <b>Вы зарегистрированы!</b>\n`;
                helpMessage += `🚛 Ожидайте уведомления о рейсах\n\n`;
              } else {
                helpMessage += `📱 <b>Для начала работы:</b>\n`;
                helpMessage += `1. Отправьте /start\n`;
                helpMessage += `2. Поделитесь номером телефона\n`;
                helpMessage += `3. Заполните данные регистрации\n\n`;
              }

              helpMessage += `🆘 <b>Нужна помощь?</b>\n`;
              helpMessage += `Обратитесь к диспетчеру или администратору системы.`;

              await sendMessage(chatId, helpMessage);

              return NextResponse.json({
                ok: true,
                status: "help_sent",
                timestamp: timestamp,
              });
            } catch (error) {
              console.error("Error processing /help:", error);
              await sendMessage(chatId, "❌ Произошла ошибка при получении справки.");
              return NextResponse.json({
                ok: true,
                status: "help_error",
                timestamp: timestamp,
              });
            }
          }

          // Обработка команды /start
          if (messageText === "/start") {
            console.log("=== PROCESSING /START COMMAND ===");

            try {
              // Очищаем любые pending actions при старте
              if (existingUser) {
                await deleteUserPendingAction(existingUser.id);
                console.log("Cleared pending actions for user on /start");
              }

              // Проверяем, зарегистрирован ли пользователь
              if (existingUser && existingUser.registration_state === "completed") {
                const registeredMessage =
                  `👋 Здравствуйте, ${existingUser.first_name}!\n\n` +
                  `✅ Вы уже зарегистрированы в системе уведомлений.\n\n` +
                  `📋 Ваши данные:\n` +
                  `👤 ФИО: ${existingUser.full_name}\n` +
                  `📱 Телефон: +${existingUser.phone}\n` +
                  `🏢 Автопарк: ${existingUser.carpark}\n\n` +
                  `🚛 Ожидайте сообщения о предстоящих рейсах.\n\n` +
                  `💡 <b>Доступные команды:</b>\n` +
                  `🗺️ /toroute - Построить маршрут между точками`;

                await sendMessage(chatId, registeredMessage);

                return NextResponse.json({
                  ok: true,
                  status: "user_already_registered",
                  timestamp: timestamp,
                });
              }

              // Если пользователь не зарегистрирован или регистрация не завершена
              const welcomeMessage =
                "🤖 Добро пожаловать в систему уведомлений!\n\n" +
                "Этот бот используется для получения важных сообщений о рейсах и логистических операциях.\n\n" +
                "📱 Для регистрации в системе необходимо поделиться номером телефона.\n\n" +
                "🔒 Ваши данные будут использованы только для отправки рабочих уведомлений.";

              await sendMessage(chatId, welcomeMessage);
              await sendContactRequest(chatId);

              console.log("=== /START COMMAND PROCESSED SUCCESSFULLY ===");

              return NextResponse.json({
                ok: true,
                status: "start_processed",
                timestamp: timestamp,
                user_id: userId,
                chat_id: chatId,
              });
            } catch (error) {
              console.error("=== ERROR PROCESSING /START ===", error);
              return NextResponse.json({
                ok: true,
                status: "start_error",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: timestamp,
              });
            }
          }

          // Проверяем, есть ли pending action для пользователя
          if (existingUser) {
            const pendingAction = await getUserPendingAction(existingUser.id);

            if (pendingAction && pendingAction.action_type === "awaiting_rejection_reason" && messageText) {
              console.log(`Processing rejection reason: "${messageText}"`);

              try {
                // Находим все pending сообщения этого пользователя
                const userMessagesResult = await sql`
                  SELECT phone, trip_id
                  FROM trip_messages 
                  WHERE telegram_id = ${userId} AND response_status = 'pending'
                  LIMIT 1
                `;

                if (userMessagesResult.length === 0) {
                  throw new Error("No pending messages found for this user");
                }

                const phone = userMessagesResult[0].phone;
                const trip_id = userMessagesResult[0].trip_id;
                console.log(`Rejecting for phone: ${phone}, trip_id: ${trip_id}`);

                // Обновляем ВСЕ сообщения этого водителя в этой рассылке
                const updateResult = await sql`
                  UPDATE trip_messages 
                  SET response_status = 'rejected', 
                      response_comment = ${messageText},
                      response_at = ${new Date().toISOString()}
                  WHERE phone = ${phone} AND trip_id = ${trip_id}
                  RETURNING id
                `;

                console.log(`Updated ${updateResult.length} messages for phone ${phone}`);

                // Удаляем pending action
                await deleteUserPendingAction(existingUser.id);

                await sendMessage(chatId, `❌ Рейс отклонен.\n\nПричина: ${messageText}\n\nСпасибо за ответ.`);

                console.log("=== REJECTION REASON PROCESSED ===");

                return NextResponse.json({
                  ok: true,
                  status: "rejection_reason_processed",
                  message_id: pendingAction.related_message_id,
                  updated_messages: updateResult.length,
                  reason: messageText,
                  timestamp: timestamp,
                });
              } catch (error) {
                console.error("Error processing rejection reason:", error);
                await sendMessage(chatId, "❌ Произошла ошибка при сохранении причины отклонения.");

                return NextResponse.json({
                  ok: true,
                  status: "rejection_reason_error",
                  error: error instanceof Error ? error.message : "Unknown error",
                  timestamp: timestamp,
                });
              }
            }
          }

          // Обработка контакта (номера телефона)
          if (message.contact) {
            console.log("=== PROCESSING CONTACT ===");
            console.log("Contact data:", message.contact);

            const phone = message.contact.phone_number;
            const name = `${message.contact.first_name} ${message.contact.last_name || ""}`.trim();

            try {
              const user = await createUser(userId, phone, name);

              const firstStepMessage =
                `📝 Отлично! Номер телефона получен: +${phone.startsWith("+") ? phone.slice(1) : phone}\n\n` +
                `Теперь для завершения регистрации:\n\n` +
                `👤 Пожалуйста, введите ваше Имя и Отчество\n` +
                `(например: Иван Петрович)`;

              await sendMessage(chatId, firstStepMessage);

              console.log("=== CONTACT PROCESSED, AWAITING FIRST NAME ===");

              return NextResponse.json({
                ok: true,
                status: "contact_processed_awaiting_first_name",
                phone: phone,
                name: name,
                timestamp: timestamp,
              });
            } catch (error) {
              console.error("=== ERROR PROCESSING CONTACT ===", error);
              await sendMessage(chatId, "❌ Произошла ошибка при регистрации. Попробуйте еще раз.");

              return NextResponse.json({
                ok: true,
                status: "contact_error",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: timestamp,
              });
            }
          }

          // Обработка текстовых сообщений в зависимости от состояния регистрации
          if (messageText && messageText !== "/start" && messageText !== "/toroute") {
            console.log("=== PROCESSING TEXT MESSAGE ===");
            console.log("Existing user:", existingUser);

            if (!existingUser) {
              // Пользователь не зарегистрирован
              const helpMessage =
                "👋 Для работы с системой уведомлений необходимо зарегистрироваться.\n\n" +
                "📱 Пожалуйста, поделитесь своим номером телефона, нажав на кнопку ниже.";

              await sendMessage(chatId, helpMessage);
              await sendContactRequest(chatId);

              return NextResponse.json({
                ok: true,
                status: "help_sent",
                timestamp: timestamp,
              });
            }

            // Обработка шагов регистрации
            if (existingUser.registration_state === "awaiting_first_name") {
              console.log(`Processing first name input: "${messageText}"`);

              // Валидация имени и отчества
              const nameParts = messageText.trim().split(/\s+/);
              if (nameParts.length < 2) {
                await sendMessage(chatId, "❌ Пожалуйста, введите Имя и Отчество через пробел.\n\nПример: Иван Петрович");
                return NextResponse.json({
                  ok: true,
                  status: "invalid_first_name_format",
                  timestamp: timestamp,
                });
              }

              try {
                await updateUserRegistrationStep(userId, "first_name", messageText.trim());

                const lastNameMessage =
                  `✅ Имя и отчество получены: ${messageText.trim()}\n\n` + `👤 Теперь введите вашу Фамилию:`;

                await sendMessage(chatId, lastNameMessage);

                console.log("=== FIRST NAME PROCESSED ===");

                return NextResponse.json({
                  ok: true,
                  status: "first_name_processed",
                  first_name: messageText.trim(),
                  timestamp: timestamp,
                });
              } catch (error) {
                console.error("Error processing first name:", error);
                await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.");

                return NextResponse.json({
                  ok: true,
                  status: "first_name_error",
                  error: error instanceof Error ? error.message : "Unknown error",
                  timestamp: timestamp,
                });
              }
            }

            if (existingUser.registration_state === "awaiting_last_name") {
              console.log(`Processing last name input: "${messageText}"`);

              // Валидация фамилии
              const lastName = messageText.trim();
              if (lastName.length < 2) {
                await sendMessage(chatId, "❌ Пожалуйста, введите корректную фамилию.");
                return NextResponse.json({
                  ok: true,
                  status: "invalid_last_name_format",
                  timestamp: timestamp,
                });
              }

              try {
                await updateUserRegistrationStep(userId, "last_name", lastName);

                const carparkMessage =
                  `✅ Фамилия получена: ${lastName}\n\n` +
                  `🏢 Последний шаг - выберите ваше автохозяйство:\n\n` +
                  `Нажмите на одну из кнопок ниже:`;

                const carparkButtons = [
                  [
                    { text: "🚛 Автопарк 8009", callback_data: "carpark_8009" },
                    { text: "🚚 Автопарк 8012", callback_data: "carpark_8012" },
                  ],
                ];

                await sendMessageWithButtons(chatId, carparkMessage, carparkButtons);

                console.log("=== LAST NAME PROCESSED, SHOWING CARPARK BUTTONS ===");

                return NextResponse.json({
                  ok: true,
                  status: "last_name_processed_awaiting_carpark",
                  last_name: lastName,
                  timestamp: timestamp,
                });
              } catch (error) {
                console.error("Error processing last name:", error);
                await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.");

                return NextResponse.json({
                  ok: true,
                  status: "last_name_error",
                  error: error instanceof Error ? error.message : "Unknown error",
                  timestamp: timestamp,
                });
              }
            }

            if (existingUser.registration_state === "completed") {
              // Пользователь уже зарегистрирован
              const registeredMessage =
                `👋 Здравствуйте, ${existingUser.first_name}!\n\n` +
                `✅ Вы уже зарегистрированы в системе уведомлений.\n\n` +
                `📋 Ваши данные:\n` +
                `👤 ФИО: ${existingUser.full_name}\n` +
                `📱 Телефон: +${existingUser.phone}\n` +
                `🏢 Автопарк: ${existingUser.carpark}\n\n` +
                `🚛 Ожидайте сообщения о предстоящих рейсах.\n\n` +
                `💡 <b>Доступные команды:</b>\n` +
                `🗺️ /toroute - Построить маршрут между точками`;

              await sendMessage(chatId, registeredMessage);

              return NextResponse.json({
                ok: true,
                status: "user_already_registered",
                timestamp: timestamp,
              });
            }

            // Неизвестное состояние
            console.log(`Unknown registration state: ${existingUser.registration_state}`);
            await sendMessage(chatId, "❓ Неизвестная команда. Используйте /start для начала работы.");

            return NextResponse.json({
              ok: true,
              status: "unknown_state",
              registration_state: existingUser.registration_state,
              timestamp: timestamp,
            });
          }

          console.log("No specific handler for this message type");
          return NextResponse.json({
            ok: true,
            status: "ignored",
            message_type: message.contact ? "contact" : messageText ? "text" : "other",
            timestamp: timestamp,
          });
        }
      }
    }
  

export async function GET() {
  console.log("GET request to telegram-webhook endpoint")

  return NextResponse.json({
    status:
      "Telegram webhook endpoint is working with FULL REGISTRATION LOGIC + CALLBACK HANDLING + ERROR RESILIENCE + ROUTE BUILDING",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel_url: process.env.VERCEL_URL,
    endpoint: "/api/telegram-webhook",
  })
}
