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
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`=== TELEGRAM WEBHOOK RECEIVED at ${timestamp} ===`)
  
  try {
    const update: TelegramUpdate = await request.json()
    console.log("=== FULL TELEGRAM UPDATE ===")
    console.log(JSON.stringify(update, null, 2))
    
    // Обработка callback query (нажатие кнопок) - ПРИОРИТЕТ!
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const userId = callbackQuery.from.id
      const chatId = callbackQuery.message?.chat.id || userId
      const messageId = callbackQuery.message?.message_id
      const data = callbackQuery.data
      
      console.log(`=== CALLBACK QUERY RECEIVED ===`)
      console.log(`User: ${userId}, Data: ${data}`)
      
      // Обработка выбора точки маршрута
      if (data?.startsWith("route_point_")) {
        const pointId = data.replace("route_point_", "")
        console.log(`Processing route point selection: ${pointId}`)
        
        try {
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }
          
          const pendingAction = await sql`
            SELECT * FROM user_pending_actions 
            WHERE user_id = ${user.id} AND action_type LIKE 'building_route_%'
          `
          
          if (!pendingAction.rows[0]) {
            await answerCallbackQuery(callbackQuery.id, "Сессия построения маршрута истекла")
            await sendMessage(chatId, "⏳ Сессия построения маршрута истекла. Начните заново с командой /toroute")
            return NextResponse.json({ ok: true, status: "route_session_expired" })
          }
          
          const allPoints = await sql`
            SELECT * FROM route_points 
            ORDER BY point_id
          `
          
          const selectedPoint = allPoints.rows.find(p => p.point_id === pointId)
          if (!selectedPoint) {
            throw new Error(`Point ${pointId} not found`)
          }
          
          let routePoints = []
          if (pendingAction.rows[0].action_type === "building_route_start") {
            // Первая точка выбрана
            routePoints = [selectedPoint]
            const stepMessage = `✅ Точка отправления: <b>${selectedPoint.point_id} ${selectedPoint.point_name}</b>\n🎯 Теперь выберите точку назначения:`
            await sendMessage(chatId, stepMessage)
          } else if (pendingAction.rows[0].action_type === "building_route_continue") {
            // Добавляем следующую точку
            const existingData = pendingAction.rows[0].action_data ? JSON.parse(pendingAction.rows[0].action_data) : { points: [] }
            routePoints = [...existingData.points, selectedPoint]
            
            // Формируем доступные точки для следующего выбора
            const selectedPointIds = routePoints.map(p => p.point_id)
            const availablePoints = allPoints.rows.filter((p: any) => !selectedPointIds.includes(p.point_id))
            
            if (availablePoints.length === 0) {
              // Все точки выбраны - завершаем маршрут
              const routeUrl = generateRouteUrl(routePoints)
              await deleteUserPendingAction(user.id)
              
              const resultMessage = `🏁 Маршрут построен!\n🔗 [Открыть маршрут в Яндекс.Картах](${routeUrl})`
              if (messageId) {
                await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
              }
              await sendMessage(chatId, resultMessage)
              return NextResponse.json({ ok: true, status: "route_completed", total_points: routePoints.length })
            } else {
              // Продолжаем построение маршрута
              await setUserPendingAction(user.id, "building_route_continue", null, { points: routePoints })
              
              const stepMessage = `✅ Добавлены точки (${routePoints.length} шт):\n` +
                routePoints.map((p: any, i: number) => `${i+1}. ${p.point_id} ${p.point_name}`).join('\n') +
                `\n🎯 Выберите следующую точку или завершите маршрут`
              
              // Формируем кнопки управления
              const controlButtons = []
              if (routePoints.length >= 2) {
                controlButtons.push({
                  text: "✅ Завершить построение маршрута",
                  callback_data: "route_finish"
                })
              }
              controlButtons.push({
                text: "❌ Отменить",
                callback_data: "route_cancel"
              })
              
              // Формируем кнопки с доступными точками
              const buttons = [controlButtons]
              for (let i = 0; i < availablePoints.length; i += 2) {
                const row = []
                row.push({
                  text: `${availablePoints[i].point_id} ${availablePoints[i].point_name}`,
                  callback_data: `route_point_${availablePoints[i].point_id}`
                })
                if (i + 1 < availablePoints.length) {
                  row.push({
                    text: `${availablePoints[i+1].point_id} ${availablePoints[i+1].point_name}`,
                    callback_data: `route_point_${availablePoints[i+1].point_id}`
                  })
                }
                buttons.push(row)
              }
              
              await sendMessageWithButtons(chatId, stepMessage, buttons)
              return NextResponse.json({ ok: true, status: "route_building_continued", point_id: pointId, total_points: routePoints.length })
            }
          }
          
          // Обновляем pending action
          await setUserPendingAction(user.id, "building_route_continue", null, { points: routePoints })
          
          // Формируем кнопки для следующей точки
          const allPoints = await sql`SELECT * FROM route_points ORDER BY point_id`
          const selectedPointIds = routePoints.map((p: any) => p.point_id)
          const availablePoints = allPoints.rows.filter((p: any) => !selectedPointIds.includes(p.point_id))
          
          const buttons = []
          // Кнопки управления
          const controlButtons = []
          if (routePoints.length >= 2) {
            controlButtons.push({
              text: "✅ Завершить построение маршрута",
              callback_data: "route_finish"
            })
          }
          controlButtons.push({
            text: "❌ Отменить",
            callback_data: "route_cancel"
          })
          buttons.push(controlButtons)
          
          // Кнопки с точками
          for (let i = 0; i < availablePoints.length; i += 2) {
            const row = []
            row.push({
              text: `${availablePoints[i].point_id} ${availablePoints[i].point_name}`,
              callback_data: `route_point_${availablePoints[i].point_id}`
            })
            if (i + 1 < availablePoints.length) {
              row.push({
                text: `${availablePoints[i+1].point_id} ${availablePoints[i+1].point_name}`,
                callback_data: `route_point_${availablePoints[i+1].point_id}`
              })
            }
            buttons.push(row)
          }
          
          await sendMessageWithButtons(chatId, "🎯 Выберите следующую точку маршрута:", buttons)
          return NextResponse.json({ ok: true, status: "route_point_selected", point_id: pointId, total_points: routePoints.length })
          
        } catch (error) {
          console.error("Error processing route point selection:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при выборе точки маршрута.")
          return NextResponse.json({ 
            ok: true,
            status: "route_point_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
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
          
          const pendingAction = await sql`
            SELECT * FROM user_pending_actions 
            WHERE user_id = ${user.id} AND action_type LIKE 'building_route_%'
          `
          
          if (!pendingAction.rows[0]) {
            await answerCallbackQuery(callbackQuery.id, "Сессия построения маршрута истекла")
            return NextResponse.json({ ok: true, status: "route_session_expired" })
          }
          
          const routeData = JSON.parse(pendingAction.rows[0].action_data)
          if (routeData.points.length < 2) {
            await answerCallbackQuery(callbackQuery.id, "Выберите минимум 2 точки для построения маршрута")
            return NextResponse.json({ ok: true, status: "not_enough_points" })
          }
          
          const routeUrl = generateRouteUrl(routeData.points)
          await deleteUserPendingAction(user.id)
          
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }
          
          const resultMessage = `🏁 Маршрут построен!\n🔗 [Открыть маршрут в Яндекс.Картах](${routeUrl})`
          await sendMessage(chatId, resultMessage)
          return NextResponse.json({ ok: true, status: "route_completed", total_points: routeData.points.length })
          
        } catch (error) {
          console.error("Error finishing route building:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при завершении построения маршрута.")
          return NextResponse.json({ 
            ok: true,
            status: "route_finish_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
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
          
          await answerCallbackQuery(callbackQuery.id, "Построение маршрута отменено")
          
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }
          
          await sendMessage(chatId, "❌ Построение маршрута отменено.")
          return NextResponse.json({ ok: true, status: "route_cancelled" })
          
        } catch (error) {
          console.error("Error cancelling route:", error)
          return NextResponse.json({ 
            ok: true,
            status: "route_cancel_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
          })
        }
      }
      
      // Обработка подтверждения рейса
      if (data?.startsWith("confirm_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing confirmation for message ${messageId}`)
        
        try {
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }
          
          // Обновляем статус сообщения в базе данных
          await sql`
            UPDATE trip_messages
            SET response_status = 'confirmed', response_time = NOW()
            WHERE id = ${messageId} AND telegram_id = ${userId}
          `
          
          await answerCallbackQuery(callbackQuery.id, "Рейс подтвержден")
          
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }
          
          await sendMessage(chatId, "✅ Рейс успешно подтвержден!")
          return NextResponse.json({ ok: true, status: "trip_confirmed", message_id: messageId })
          
        } catch (error) {
          console.error("Error confirming trip:", error)
          await answerCallbackQuery(callbackQuery.id, "Ошибка при подтверждении рейса")
          return NextResponse.json({ 
            ok: true,
            status: "trip_confirmation_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
          })
        }
      }
      
      // Обработка отклонения рейса
      if (data?.startsWith("reject_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing rejection for message ${messageId}`)
        
        try {
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }
          
          // Проверяем, есть ли у пользователя сообщения в ожидании ответа
          const pendingCheck = await sql`
            SELECT COUNT(*) as count
            FROM trip_messages
            WHERE telegram_id = ${userId} AND response_status = 'pending'
          `
          
          if (pendingCheck.rows[0].count === 0) {
            throw new Error("No pending messages found for this user")
          }
          
          // Обновляем статус сообщения
          await sql`
            UPDATE trip_messages
            SET response_status = 'rejected', response_time = NOW()
            WHERE id = ${messageId} AND telegram_id = ${userId}
          `
          
          await answerCallbackQuery(callbackQuery.id, "Рейс отклонен")
          
          if (messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }
          
          // Запрашиваем причину отклонения
          await sendMessage(chatId, "📝 Пожалуйста, укажите причину отклонения рейса в ответ на это сообщение:")
          return NextResponse.json({ ok: true, status: "awaiting_rejection_reason" })
          
        } catch (error) {
          console.error("Error processing rejection:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при обработке отклонения.")
          return NextResponse.json({ ok: true, status: "rejection_error" })
        }
      }
      
      // Неизвестный callback query
      console.log("❓ Unknown callback query data:", data)
      await answerCallbackQuery(callbackQuery.id, "Неизвестная команда")
      return NextResponse.json({ ok: true, status: "callback_ignored" })
    }
    
    // Обработка текстовых сообщений
    if (update.message) {
      const message = update.message
      const chatId = message.chat.id
      const userId = message.from?.id
      const messageText = message.text
      
      console.log(`=== TEXT MESSAGE RECEIVED ===`)
      console.log(`User: ${userId}, Message: ${messageText}`)
      
      // Получаем пользователя из БД
      const existingUser = await getUserByTelegramId(userId)
      
      // Обработка команды /start
      if (messageText === "/start") {
        console.log("=== PROCESSING /START COMMAND ===")
        
        try {
          if (existingUser) {
            await deleteUserPendingAction(existingUser.id)
            console.log("Cleared pending actions for user on /start")
          }
          
          // Приветственное сообщение
          const welcomeMessage = "🤖 Добро пожаловать в систему уведомлений!\n" +
            "Этот бот используется для получения важных сообщений о рейсах и логистических операциях.\n" +
            "📱 Для регистрации в системе необходимо поделиться номером телефона.\n" +
            "🔒 Ваши данные будут использованы только для отправки рабочих уведомлений."
          
          await sendMessage(chatId, welcomeMessage)
          await sendContactRequest(chatId)
          
          console.log("=== /START COMMAND PROCESSED SUCCESSFULLY ===")
          return NextResponse.json({ 
            ok: true,
            status: "start_processed",
            timestamp: timestamp,
            user_id: userId,
            chat_id: chatId 
          })
          
        } catch (error) {
          console.error("=== ERROR PROCESSING /START ===", error)
          await sendMessage(chatId, "❌ Произошла ошибка при обработке команды /start.")
          return NextResponse.json({ 
            ok: true,
            status: "start_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
          })
        }
      }
      
      // Обработка команды /toroute
      if (messageText === "/toroute") {
        console.log("=== PROCESSING /TOROUTE COMMAND ===")
        
        try {
          if (!existingUser) {
            await sendMessage(chatId, "❌ Для использования этой команды необходимо зарегистрироваться.")
            return NextResponse.json({ ok: true, status: "unauthorized" })
          }
          
          if (existingUser.registration_state !== "completed") {
            await sendMessage(chatId, "❌ Регистрация не завершена. Сначала завершите регистрацию.")
            return NextResponse.json({ ok: true, status: "registration_not_completed" })
          }
          
          // Очищаем любые pending actions при старте команды
          await deleteUserPendingAction(existingUser.id)
          
          // Получаем все доступные точки
          const allPointsResult = await sql`SELECT * FROM route_points ORDER BY point_id`
          
          if (allPointsResult.rowCount < 2) {
            await sendMessage(chatId, "❌ Недостаточно точек с координатами для построения маршрута. Обратитесь к администратору.")
            return NextResponse.json({ ok: true, status: "insufficient_points", timestamp: timestamp })
          }
          
          const allPoints = allPointsResult.rows
          
          // Устанавливаем pending action для начала построения маршрута
          await setUserPendingAction(existingUser.id, "building_route_start", null, { points: [] })
          
          const welcomeMessage = "🗺️ <b>Построение маршрута</b>\n" +
            "📍 Выберите точку отправления из списка ниже:"
          
          // Формируем кнопки с точками (по 2 в ряд)
          const buttons = []
          for (let i = 0; i < allPoints.length; i += 2) {
            const row = []
            row.push({
              text: `${allPoints[i].point_id} ${allPoints[i].point_name}`,
              callback_data: `route_point_${allPoints[i].point_id}`
            })
            if (i + 1 < allPoints.length) {
              row.push({
                text: `${allPoints[i+1].point_id} ${allPoints[i+1].point_name}`,
                callback_data: `route_point_${allPoints[i+1].point_id}`
              })
            }
            buttons.push(row)
          }
          
          await sendMessageWithButtons(chatId, welcomeMessage, buttons)
          
          return NextResponse.json({ 
            ok: true,
            status: "toroute_started",
            available_points: allPoints.length,
            timestamp: timestamp 
          })
          
        } catch (error) {
          console.error("=== ERROR PROCESSING /TOROUTE ===", error)
          await sendMessage(chatId, "❌ Произошла ошибка при запуске построения маршрута.")
          return NextResponse.json({ 
            ok: true,
            status: "toroute_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
          })
        }
      }
      
      // Обработка команды /status
      if (messageText === "/status") {
        console.log("=== PROCESSING /STATUS COMMAND ===")
        
        try {
          if (!existingUser) {
            await sendMessage(chatId, "❌ Вы не зарегистрированы в системе.")
            return NextResponse.json({ ok: true, status: "not_registered" })
          }
          
          const statusMessage = `📊 <b>Статус регистрации:</b>\n` +
            `👤 ФИО: ${existingUser.full_name}\n` +
            `📱 Телефон: +${existingUser.phone}\n` +
            `🏢 Автопарк: ${existingUser.carpark}\n` +
            `✅ Статус: ${existingUser.registration_state}\n\n` +
            `💡 Используйте /start для повторной регистрации или /toroute для построения маршрута`
          
          await sendMessage(chatId, statusMessage)
          return NextResponse.json({ ok: true, status: "status_shown", registration_state: existingUser.registration_state })
          
        } catch (error) {
          console.error("Error processing /status:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при получении статуса регистрации.")
          return NextResponse.json({ 
            ok: true,
            status: "status_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
          })
        }
      }
      
      // Обработка контакта (номера телефона)
      if (message.contact) {
        console.log("=== PROCESSING CONTACT ===")
        console.log("Contact data:", message.contact)
        
        const phone = message.contact.phone_number
        
        try {
          // Проверяем, есть ли пользователь с таким телефоном
          const existingUserResult = await sql`
            SELECT * FROM users WHERE phone = ${phone}
          `
          
          if (existingUserResult.rows[0]) {
            // Пользователь уже зарегистрирован
            await sendMessage(chatId, "✅ Вы уже зарегистрированы в системе.")
            return NextResponse.json({ ok: true, status: "user_already_registered" })
          }
          
          // Создаем нового пользователя
          const newUserResult = await sql`
            INSERT INTO users (telegram_id, phone, registration_state)
            VALUES (${message.from.id}, ${phone}, 'awaiting_first_name')
            RETURNING *
          `
          
          const newUser = newUserResult.rows[0]
          
          // Запрашиваем имя
          const firstStepMessage = "👋 Здравствуйте!\n" +
            "✅ Ваш номер телефона получен.\n" +
            "📝 Пожалуйста, введите ваше имя (например: Иван)"
          
          await sendMessage(chatId, firstStepMessage)
          
          console.log("=== CONTACT PROCESSED, AWAITING FIRST NAME ===")
          return NextResponse.json({ 
            ok: true,
            status: "contact_processed_awaiting_first_name",
            phone: phone,
            name: newUser.full_name,
            timestamp: timestamp 
          })
          
        } catch (error) {
          console.error("=== ERROR PROCESSING CONTACT ===", error)
          await sendMessage(chatId, "❌ Произошла ошибка при регистрации. Попробуйте еще раз.")
          return NextResponse.json({ 
            ok: true,
            status: "contact_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp 
          })
        }
      }
      
      // Обработка текстовых сообщений в зависимости от состояния регистрации
      if (messageText && messageText !== "/start" && messageText !== "/toroute") {
        console.log("=== PROCESSING TEXT MESSAGE ===")
        console.log("Existing user:", existingUser)
        
        if (!existingUser) {
          // Пользователь не зарегистрирован
          const helpMessage = "👋 Для работы с системой уведомлений необходимо зарегистрироваться.\n" +
            "📱 Пожалуйста, поделитесь своим номером телефона, нажав на кнопку ниже."
          
          await sendMessage(chatId, helpMessage)
          await sendContactRequest(chatId)
          return NextResponse.json({ ok: true, status: "registration_required" })
        }
        
        if (existingUser.registration_state === "awaiting_first_name") {
          // Обработка имени
          console.log(`Processing first name input: "${messageText}"`)
          
          const firstName = messageText.trim()
          
          // Валидация имени
          if (firstName.length < 2) {
            await sendMessage(chatId, "❌ Пожалуйста, введите корректное имя.")
            return NextResponse.json({ ok: true, status: "invalid_first_name_format", timestamp: timestamp })
          }
          
          try {
            await updateUserRegistrationStep(existingUser.id, "first_name", firstName)
            
            const lastNameMessage = "✅ Имя получено: " + firstName + "\n" +
              "📝 Теперь введите вашу фамилию (например: Иванов)"
            
            await sendMessage(chatId, lastNameMessage)
            return NextResponse.json({ 
              ok: true,
              status: "first_name_processed_awaiting_last_name",
              first_name: firstName,
              timestamp: timestamp 
            })
            
          } catch (error) {
            console.error("Error processing first name:", error)
            await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")
            return NextResponse.json({ 
              ok: true,
              status: "first_name_error",
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: timestamp 
            })
          }
        }
        
        if (existingUser.registration_state === "awaiting_last_name") {
          // Обработка фамилии
          console.log(`Processing last name input: "${messageText}"`)
          
          const lastName = messageText.trim()
          
          // Валидация фамилии
          if (lastName.length < 2) {
            await sendMessage(chatId, "❌ Пожалуйста, введите корректную фамилию.")
            return NextResponse.json({ ok: true, status: "invalid_last_name_format", timestamp: timestamp })
          }
          
          try {
            await updateUserRegistrationStep(existingUser.id, "last_name", lastName)
            
            const carparkMessage = "✅ Фамилия получена: " + lastName + "\n" +
              "🏢 Последний шаг - выберите ваше автохозяйство:\n" +
              "Нажмите на одну из кнопок ниже:"
            
            const carparkButtons = [[
              { text: "🚛 Автопарк 8009", callback_data: "carpark_8009" },
              { text: "🚚 Автопарк 8012", callback_data: "carpark_8012" }
            ]]
            
            await sendMessageWithButtons(chatId, carparkMessage, carparkButtons)
            console.log("=== LAST NAME PROCESSED, SHOWING CARPARK BUTTONS ===")
            
            return NextResponse.json({ 
              ok: true,
              status: "last_name_processed_awaiting_carpark",
              last_name: lastName,
              timestamp: timestamp 
            })
            
          } catch (error) {
            console.error("Error processing last name:", error)
            await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")
            return NextResponse.json({ 
              ok: true,
              status: "last_name_error",
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: timestamp 
            })
          }
        }
        
        if (existingUser.registration_state === "completed") {
          // Пользователь уже зарегистрирован
          const registeredMessage = "👋 Здравствуйте, " + existingUser.first_name + "!\n" +
            "✅ Вы уже зарегистрированы в системе уведомлений.\n" +
            "📋 Ваши данные:\n" +
            "👤 ФИО: " + existingUser.full_name + "\n" +
            "📱 Телефон: +" + existingUser.phone + "\n" +
            "🏢 Автопарк: " + existingUser.carpark + "\n" +
            "🚛 Ожидайте сообщения о предстоящих рейсах.\n" +
            "💡 <b>Доступные команды:</b>\n" +
            "🗺️ /toroute - Построить маршрут между точками"
          
          await sendMessage(chatId, registeredMessage)
          return NextResponse.json({ ok: true, status: "user_already_registered", timestamp: timestamp })
        }
      }
    }
    
    return NextResponse.json({ ok: true, status: "unknown_update_type" })
    
  } catch (error) {
    console.error("=== UNHANDLED ERROR ===")
    console.error("Error details:", error)
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace")
    
    // Всегда возвращаем ok: true чтобы не блокировать webhook
    return NextResponse.json({ 
      ok: true,
      status: "error_handled",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: timestamp 
    })
  }
}

export async function GET() {
  console.log("GET request to telegram-webhook endpoint")
  return NextResponse.json({ 
    status: "Telegram webhook endpoint is working with FULL REGISTRATION LOGIC + CALLBACK HANDLING + ERROR RESILIENCE + ROUTE BUILDING" 
  })
}

// Вспомогательные функции
function generateRouteUrl(points: any[]): string {
  if (points.length < 2) return ''
  
  const coordinates = points.map((p) => `${p.latitude},${p.longitude}`).join("~")
  return `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`
}
