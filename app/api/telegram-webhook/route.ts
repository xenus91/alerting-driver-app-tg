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

async function setUserPendingAction(userId: number, actionType: string, relatedMessageId?: number) {
  try {
    const result = await sql`
      INSERT INTO user_pending_actions (user_id, action_type, related_message_id)
      VALUES (${userId}, ${actionType}, ${relatedMessageId || null})
      ON CONFLICT (user_id) DO UPDATE SET
        action_type = EXCLUDED.action_type,
        related_message_id = EXCLUDED.related_message_id,
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

      // Обработка подтверждения рейса
      if (data?.startsWith("confirm_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing confirmation for message ${messageId}`)

        try {
          // Получаем информацию о сообщении напрямую
          const messageResult = await sql`
            SELECT phone, trip_id
            FROM trip_messages 
            WHERE id = ${messageId}
            LIMIT 1
          `

          let phone, trip_id
          if (messageResult.length === 0) {
            console.log(`Message ${messageId} not found, trying to find by user telegram_id`)

            // Альтернативный поиск: найдем любое сообщение этого пользователя
            const userMessageResult = await sql`
              SELECT phone, trip_id
              FROM trip_messages tm
              WHERE tm.telegram_id = ${userId} AND tm.response_status = 'pending'
              LIMIT 1
            `

            if (userMessageResult.length === 0) {
              throw new Error(`No pending messages found for user ${userId}`)
            }

            console.log(`Found alternative message for user ${userId}:`, userMessageResult[0])
            phone = userMessageResult[0].phone
            trip_id = userMessageResult[0].trip_id
          } else {
            phone = messageResult[0].phone
            trip_id = messageResult[0].trip_id
          }

          console.log(`Confirming for phone: ${phone}, trip_id: ${trip_id}`)

          // Обновляем ВСЕ сообщения этого водителя в этой рассылке
          const updateResult = await sql`
            UPDATE trip_messages 
            SET response_status = 'confirmed', 
                response_comment = NULL,
                response_at = ${new Date().toISOString()}
            WHERE phone = ${phone} AND trip_id = ${trip_id}
            RETURNING id
          `

          console.log(`Updated ${updateResult.length} messages for phone ${phone}`)

          // Отвечаем на callback query (игнорируем ошибки старых запросов)
          await answerCallbackQuery(callbackQuery.id, "Спасибо! Рейс подтвержден!")

          // Скрываем кнопки после подтверждения
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] })
          }

          await sendMessage(chatId, "✅ Спасибо! Рейс подтвержден!")

          console.log("=== CONFIRMATION PROCESSED ===")

          return NextResponse.json({
            ok: true,
            status: "confirmed_processed",
            message_id: messageId,
            updated_messages: updateResult.length,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing confirmation:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при обработке подтверждения.")

          return NextResponse.json({
            ok: true, // Возвращаем ok: true чтобы не блокировать webhook
            status: "confirmation_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      // Обработка отклонения рейса - сразу запрашиваем комментарий
      if (data?.startsWith("reject_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing rejection for message ${messageId}`)

        try {
          // Получаем пользователя
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }

          // Проверяем, что у пользователя есть pending сообщения
          const pendingCheck = await sql`
            SELECT COUNT(*) as count
            FROM trip_messages 
            WHERE telegram_id = ${userId} AND response_status = 'pending'
          `

          if (pendingCheck[0].count === 0) {
            throw new Error("No pending messages found for this user")
          }

          // Устанавливаем pending action для ожидания причины
          // Используем messageId или любой ID для связи
          await setUserPendingAction(user.id, "awaiting_rejection_reason", messageId)

          // Отвечаем на callback query (игнорируем ошибки старых запросов)
          await answerCallbackQuery(callbackQuery.id, "Внесите комментарий")

          // Скрываем кнопки исходного сообщения после отклонения
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] })
          }

          await sendMessage(
            chatId,
            `📝 Пожалуйста, укажите причину отклонения рейса:\n\n(Напишите сообщение с причиной отклонения)`,
          )

          console.log("=== AWAITING REJECTION REASON ===")

          return NextResponse.json({
            ok: true,
            status: "awaiting_rejection_reason",
            message_id: messageId,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing rejection:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при обработке отклонения.")

          return NextResponse.json({
            ok: true, // Возвращаем ok: true чтобы не блокировать webhook
            status: "rejection_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      console.log("❓ Unknown callback query data:", data)
      // Игнорируем неизвестные callback query без ошибок
      await answerCallbackQuery(callbackQuery.id, "Неизвестная команда")
      return NextResponse.json({ ok: true, status: "callback_ignored" })
    }

    if (!update.message) {
      console.log("No message in update, returning OK")
      return NextResponse.json({ ok: true, status: "no_message" })
    }

    const message = update.message
    const chatId = message.chat.id
    const userId = message.from.id
    const messageText = message.text

    console.log(`=== PROCESSING MESSAGE ===`)
    console.log(`User: ${userId} (${message.from.first_name})`)
    console.log(`Chat: ${chatId}`)
    console.log(`Text: "${messageText}"`)

    // Получаем информацию о пользователе
    const existingUser = await getUserByTelegramId(userId)

    // Проверяем, есть ли pending action для пользователя
    if (existingUser) {
      const pendingAction = await getUserPendingAction(existingUser.id)

      if (pendingAction && pendingAction.action_type === "awaiting_rejection_reason" && messageText) {
        console.log(`Processing rejection reason: "${messageText}"`)

        try {
          // Находим все pending сообщения этого пользователя
          const userMessagesResult = await sql`
            SELECT phone, trip_id
            FROM trip_messages 
            WHERE telegram_id = ${userId} AND response_status = 'pending'
            LIMIT 1
          `

          if (userMessagesResult.length === 0) {
            throw new Error("No pending messages found for this user")
          }

          const phone = userMessagesResult[0].phone
          const trip_id = userMessagesResult[0].trip_id
          console.log(`Rejecting for phone: ${phone}, trip_id: ${trip_id}`)

          // Обновляем ВСЕ сообщения этого водителя в этой рассылке
          const updateResult = await sql`
            UPDATE trip_messages 
            SET response_status = 'rejected', 
                response_comment = ${messageText},
                response_at = ${new Date().toISOString()}
            WHERE phone = ${phone} AND trip_id = ${trip_id}
            RETURNING id
          `

          console.log(`Updated ${updateResult.length} messages for phone ${phone}`)

          // Удаляем pending action
          await deleteUserPendingAction(existingUser.id)

          await sendMessage(chatId, `❌ Рейс отклонен.\n\nПричина: ${messageText}\n\nСпасибо за ответ.`)

          console.log("=== REJECTION REASON PROCESSED ===")

          return NextResponse.json({
            ok: true,
            status: "rejection_reason_processed",
            message_id: pendingAction.related_message_id,
            updated_messages: updateResult.length,
            reason: messageText,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing rejection reason:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при сохранении причины отклонения.")

          return NextResponse.json({
            ok: true, // Возвращаем ok: true чтобы не блокировать webhook
            status: "rejection_reason_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }
    }

    // Обработка команды /start
    if (messageText === "/start") {
      console.log("=== PROCESSING /START COMMAND ===")

      try {
        const welcomeMessage =
          "🤖 Добро пожаловать в систему уведомлений!\n\n" +
          "Этот бот используется для получения важных сообщений о рейсах и логистических операциях.\n\n" +
          "📱 Для регистрации в системе необходимо поделиться номером телефона.\n\n" +
          "🔒 Ваши данные будут использованы только для отправки рабочих уведомлений."

        await sendMessage(chatId, welcomeMessage)
        await sendContactRequest(chatId)

        console.log("=== /START COMMAND PROCESSED SUCCESSFULLY ===")

        return NextResponse.json({
          ok: true,
          status: "start_processed",
          timestamp: timestamp,
          user_id: userId,
          chat_id: chatId,
        })
      } catch (error) {
        console.error("=== ERROR PROCESSING /START ===", error)
        return NextResponse.json({
          ok: true, // Возвращаем ok: true чтобы не блокировать webhook
          status: "start_error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: timestamp,
        })
      }
    }

    // Обработка контакта (номера телефона)
    if (message.contact) {
      console.log("=== PROCESSING CONTACT ===")
      console.log("Contact data:", message.contact)

      const phone = message.contact.phone_number
      const name = `${message.contact.first_name} ${message.contact.last_name || ""}`.trim()

      try {
        const user = await createUser(userId, phone, name)

        const firstStepMessage =
          `📝 Отлично! Номер телефона получен: +${phone.startsWith("+") ? phone.slice(1) : phone}\n\n` +
          `Теперь для завершения регистрации:\n\n` +
          `👤 Пожалуйста, введите ваше Имя и Отчество\n` +
          `(например: Иван Петрович)`

        await sendMessage(chatId, firstStepMessage)

        console.log("=== CONTACT PROCESSED, AWAITING FIRST NAME ===")

        return NextResponse.json({
          ok: true,
          status: "contact_processed_awaiting_first_name",
          phone: phone,
          name: name,
          timestamp: timestamp,
        })
      } catch (error) {
        console.error("=== ERROR PROCESSING CONTACT ===", error)
        await sendMessage(chatId, "❌ Произошла ошибка при регистрации. Попробуйте еще раз.")

        return NextResponse.json({
          ok: true, // Возвращаем ok: true чтобы не блокировать webhook
          status: "contact_error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: timestamp,
        })
      }
    }

    // Обработка текстовых сообщений в зависимости от состояния регистрации
    if (messageText && messageText !== "/start") {
      console.log("=== PROCESSING TEXT MESSAGE ===")
      console.log("Existing user:", existingUser)

      if (!existingUser) {
        // Пользователь не зарегистрирован
        const helpMessage =
          "👋 Для работы с системой уведомлений необходимо зарегистрироваться.\n\n" +
          "📱 Пожалуйста, поделитесь своим номером телефона, нажав на кнопку ниже."

        await sendMessage(chatId, helpMessage)
        await sendContactRequest(chatId)

        return NextResponse.json({
          ok: true,
          status: "help_sent",
          timestamp: timestamp,
        })
      }

      // Обработка шагов регистрации
      if (existingUser.registration_state === "awaiting_first_name") {
        console.log(`Processing first name input: "${messageText}"`)

        // Валидация имени и отчества
        const nameParts = messageText.trim().split(/\s+/)
        if (nameParts.length < 2) {
          await sendMessage(chatId, "❌ Пожалуйста, введите Имя и Отчество через пробел.\n\nПример: Иван Петрович")
          return NextResponse.json({
            ok: true,
            status: "invalid_first_name_format",
            timestamp: timestamp,
          })
        }

        try {
          await updateUserRegistrationStep(userId, "first_name", messageText.trim())

          const lastNameMessage =
            `✅ Имя и отчество получены: ${messageText.trim()}\n\n` + `👤 Теперь введите вашу Фамилию:`

          await sendMessage(chatId, lastNameMessage)

          console.log("=== FIRST NAME PROCESSED ===")

          return NextResponse.json({
            ok: true,
            status: "first_name_processed",
            first_name: messageText.trim(),
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing first name:", error)
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")

          return NextResponse.json({
            ok: true, // Возвращаем ok: true чтобы не блокировать webhook
            status: "first_name_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      if (existingUser.registration_state === "awaiting_last_name") {
        console.log(`Processing last name input: "${messageText}"`)

        // Валидация фамилии
        const lastName = messageText.trim()
        if (lastName.length < 2) {
          await sendMessage(chatId, "❌ Пожалуйста, введите корректную фамилию.")
          return NextResponse.json({
            ok: true,
            status: "invalid_last_name_format",
            timestamp: timestamp,
          })
        }

        try {
          await updateUserRegistrationStep(userId, "last_name", lastName)

          const carparkMessage =
            `✅ Фамилия получена: ${lastName}\n\n` +
            `🏢 Последний шаг - выберите ваше автохозяйство:\n\n` +
            `Нажмите на одну из кнопок ниже:`

          const carparkButtons = [
            [
              { text: "🚛 Автопарк 8009", callback_data: "carpark_8009" },
              { text: "🚚 Автопарк 8012", callback_data: "carpark_8012" },
            ],
          ]

          await sendMessageWithButtons(chatId, carparkMessage, carparkButtons)

          console.log("=== LAST NAME PROCESSED, SHOWING CARPARK BUTTONS ===")

          return NextResponse.json({
            ok: true,
            status: "last_name_processed_awaiting_carpark",
            last_name: lastName,
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing last name:", error)
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")

          return NextResponse.json({
            ok: true, // Возвращаем ok: true чтобы не блокировать webhook
            status: "last_name_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
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
          `🚛 Ожидайте сообщения о предстоящих рейсах.`

        await sendMessage(chatId, registeredMessage)

        return NextResponse.json({
          ok: true,
          status: "user_already_registered",
          timestamp: timestamp,
        })
      }

      // Неизвестное состояние
      console.log(`Unknown registration state: ${existingUser.registration_state}`)
      await sendMessage(chatId, "❓ Неизвестная команда. Используйте /start для начала работы.")

      return NextResponse.json({
        ok: true,
        status: "unknown_state",
        registration_state: existingUser.registration_state,
        timestamp: timestamp,
      })
    }

    console.log("No specific handler for this message type")
    return NextResponse.json({
      ok: true,
      status: "ignored",
      message_type: message.contact ? "contact" : messageText ? "text" : "other",
      timestamp: timestamp,
    })
  } catch (error) {
    console.error("=== CRITICAL TELEGRAM WEBHOOK ERROR ===")
    console.error("Error details:", error)
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace")

    // Всегда возвращаем ok: true чтобы не блокировать webhook
    return NextResponse.json({
      ok: true,
      status: "error_handled",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: timestamp,
    })
  }
}

export async function GET() {
  console.log("GET request to telegram-webhook endpoint")

  return NextResponse.json({
    status: "Telegram webhook endpoint is working with FULL REGISTRATION LOGIC + CALLBACK HANDLING + ERROR RESILIENCE",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel_url: process.env.VERCEL_URL,
    endpoint: "/api/telegram-webhook",
  })
}
