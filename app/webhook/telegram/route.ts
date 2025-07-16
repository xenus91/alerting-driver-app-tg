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

  console.log("=== SENDING REPLY MESSAGE ===")
  console.log("Chat ID:", chatId)
  console.log("Reply to Message ID:", replyToMessageId)
  console.log("Text:", text)

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_to_message_id: replyToMessageId
    }

    console.log("Reply payload:", JSON.stringify(payload, null, 2))

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log("Reply API response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      throw new Error(data.description || "Failed to send reply message")
    }

    console.log("=== REPLY MESSAGE SENT SUCCESSFULLY ===")
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
          inline_keyboard: buttons,
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
              full_name = temp_last_name || ' ' || temp_first_name,
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

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`=== MAIN TELEGRAM WEBHOOK RECEIVED at ${timestamp} ===`)

  try {
    const update: TelegramUpdate = await request.json()
    console.log("=== FULL TELEGRAM UPDATE ===")
    console.log(JSON.stringify(update, null, 2))

    // Обработка callback query (нажатие кнопок)
    if (update.callback_query) {
      console.log("=== PROCESSING CALLBACK QUERY ===")
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const userId = callbackQuery.from.id
      const data = callbackQuery.data

      console.log(`Callback query from user ${userId}: ${data}`)

      if (!chatId) {
        console.log("No chat ID in callback query")
        return NextResponse.json({ ok: true, status: "no_chat_id" })
      }

      // Обработка выбора автопарка
      if (data?.startsWith("carpark_")) {
        const carpark = data.replace("carpark_", "")
        console.log(`User ${userId} selected carpark: ${carpark}`)

        try {
          const user = await updateUserRegistrationStep(userId, "carpark", carpark)
          console.log("Registration completed for user:", user)

          await answerCallbackQuery(callbackQuery.id, "Автопарк выбран!")

          const completionMessage =
            `✅ Отлично! Регистрация завершена.\n\n` +
            `👤 Уважаемый ${user.first_name}!\n\n` +
            `Вы успешно зарегистрированы в системе уведомлений.\n` +
            `📱 Телефон: ${user.phone}\n` +
            `🏢 Автопарк: ${carpark}\n\n` +
            `Ожидайте оповещения о предстоящих рейсах.`

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
          console.error("Error completing registration:", error)
          await answerCallbackQuery(callbackQuery.id, "Произошла ошибка")
          await sendMessage(chatId, "❌ Произошла ошибка при завершении регистрации. Попробуйте еще раз.")

          return NextResponse.json(
            {
              ok: false,
              error: "Failed to complete registration",
              details: error instanceof Error ? error.message : "Unknown error",
              timestamp: timestamp,
            },
            { status: 500 },
          )
        }
      }

      // Обработка подтверждения рейса - ПЕРЕРАБОТАННЫЙ БЛОК
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

            console.log(`Found alternative message for user ${userId}:`, userMessageResult[0])
            phone = userMessageResult[0].phone
            trip_id = userMessageResult[0].trip_id
            telegramMessageId = userMessageResult[0].telegram_message_id
          } else {
            phone = messageResult[0].phone
            trip_id = messageResult[0].trip_id
            telegramMessageId = messageResult[0].telegram_message_id
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

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, "Спасибо! Рейс подтвержден!")

          // Скрываем кнопки после подтверждения
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] })
          }

          // Форматируем сообщение о подтверждении
          const confirmationMessage = `✅ <b>Рейс(ы) подтвержден(ы)</b>\n\nСпасибо за ваш ответ!`

          // Отправляем реплай на исходное сообщение с рейсами
          await sendReplyToMessage(chatId, telegramMessageId, confirmationMessage)

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
            ok: true,
            status: "confirmation_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

      // Обработка отклонения рейса - ПЕРЕРАБОТАННЫЙ БЛОК
      if (data?.startsWith("reject_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        console.log(`Processing rejection for message ${messageId}`)

        try {
          // Получаем пользователя
          const user = await getUserByTelegramId(userId)
          if (!user) {
            throw new Error("User not found")
          }

          // Находим сообщение в базе данных
          const messageResult = await sql`
            SELECT trip_id, phone, telegram_message_id
            FROM trip_messages
            WHERE id = ${messageId} AND telegram_id = ${userId}
            LIMIT 1
          `

          if (messageResult.length === 0) {
            throw new Error("Message not found for this user")
          }

          const trip_id = messageResult[0].trip_id
          const phone = messageResult[0].phone
          const telegramMessageId = messageResult[0].telegram_message_id

          // Устанавливаем pending action для ожидания причины
          await setUserPendingAction(user.id, "awaiting_rejection_reason", messageId, {
            trip_id,
            phone,
            telegramMessageId
          })

          // Отвечаем на callback query
          await answerCallbackQuery(callbackQuery.id, "Укажите причину отклонения")

          // Скрываем кнопки исходного сообщения после отклонения
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] })
          }

          // Отправляем запрос на причину отклонения как реплай
          const rejectionRequest = `📝 Пожалуйста, укажите причину отклонения рейса:`
          await sendReplyToMessage(chatId, telegramMessageId, rejectionRequest)

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
            ok: true,
            status: "rejection_error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          })
        }
      }

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

    // Обработка команды /start
    if (messageText === "/start") {
      console.log("=== PROCESSING /START COMMAND ===")

      try {
        const welcomeMessage =
          "🤖 Добро пожаловать в систему уведомлений!\n\n" +
          "Этот бот используется для получения важных сообщений о рейсах.\n\n" +
          "📱 Для регистрации в системе, пожалуйста, поделитесь своим номером телефона."

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
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to process start command",
            timestamp: timestamp,
          },
          { status: 500 },
        )
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
          `📝 Отлично! Номер телефона получен.\n\n` +
          `Теперь для завершения регистрации:\n\n` +
          `👤 Пришлите Ваше Имя и Отчество\n` +
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

        return NextResponse.json(
          {
            ok: false,
            error: "Failed to process contact",
            timestamp: timestamp,
          },
          { status: 500 },
        )
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

        try {
          await updateUserRegistrationStep(userId, "first_name", messageText.trim())

          const lastNameMessage =
            `✅ Имя и отчество получены: ${messageText.trim()}\n\n` + `👤 Теперь пришлите Вашу Фамилию`

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

          return NextResponse.json(
            {
              ok: false,
              error: "Failed to process first name",
              timestamp: timestamp,
            },
            { status: 500 },
          )
        }
      }

      if (existingUser.registration_state === "awaiting_last_name") {
        console.log(`Processing last name input: "${messageText}"`)

        try {
          await updateUserRegistrationStep(userId, "last_name", messageText.trim())

          const carparkMessage = `✅ Фамилия получена: ${messageText.trim()}\n\n` + `🏢 Выберите свое автохозяйство:`

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
            last_name: messageText.trim(),
            timestamp: timestamp,
          })
        } catch (error) {
          console.error("Error processing last name:", error)
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")

          return NextResponse.json(
            {
              ok: false,
              error: "Failed to process last name",
              timestamp: timestamp,
            },
            { status: 500 },
          )
        }
      }

      if (existingUser.registration_state === "completed") {
        // Пользователь уже зарегистрирован
        const registeredMessage =
          `👋 Здравствуйте, ${existingUser.first_name}!\n\n` +
          `Вы уже зарегистрированы в системе уведомлений.\n` +
          `Ожидайте сообщения о предстоящих рейсах.`

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

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: timestamp,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  console.log("GET request to main telegram webhook endpoint")

  return NextResponse.json({
    status: "Main Telegram webhook endpoint is working",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel_url: process.env.VERCEL_URL,
    public: true,
  })
}
