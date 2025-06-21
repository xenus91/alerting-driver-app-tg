import type { NextRequest } from "next/server"

export const runtime = "edge"

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
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    const result = await sql`
      INSERT INTO users (telegram_id, phone, name, registration_state)
      VALUES (${telegramId}, ${normalizedPhone}, ${name}, 'awaiting_first_name')
      ON CONFLICT (telegram_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        name = EXCLUDED.name,
        registration_state = 'awaiting_first_name'
      RETURNING *
    `
    return result[0]
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

async function getUserByTelegramId(telegramId: number) {
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`
      SELECT * FROM users WHERE telegram_id = ${telegramId}
    `
    return result[0]
  } catch (error) {
    console.error("Error getting user by telegram id:", error)
    throw error
  }
}

async function updateUserRegistrationStep(telegramId: number, step: string, data?: any) {
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

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

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`=== EDGE FUNCTION TELEGRAM WEBHOOK RECEIVED at ${timestamp} ===`)

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  }

  try {
    console.log("Request headers:", Object.fromEntries(request.headers.entries()))
    console.log("Request method:", request.method)
    console.log("Request URL:", request.url)

    const update: TelegramUpdate = await request.json()
    console.log("Telegram update:", JSON.stringify(update, null, 2))

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
        return new Response(JSON.stringify({ ok: true, status: "no_chat_id" }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // Обработка выбора автопарка
      if (data?.startsWith("carpark_")) {
        const carpark = data.replace("carpark_", "")
        console.log(`User selected carpark: ${carpark}`)

        try {
          const user = await updateUserRegistrationStep(userId, "carpark", carpark)

          await answerCallbackQuery(callbackQuery.id, "Автопарк выбран!")

          const completionMessage =
            `✅ Отлично! Регистрация завершена.\n\n` +
            `👤 Уважаемый ${user.first_name}!\n\n` +
            `Вы успешно зарегистрированы в системе уведомлений.\n` +
            `📱 Телефон: ${user.phone}\n` +
            `🏢 Автопарк: ${carpark}\n\n` +
            `Ожидайте оповещения о предстоящих рейсах.`

          await sendMessage(chatId, completionMessage)

          console.log("=== USER REGISTRATION COMPLETED ===")

          return new Response(
            JSON.stringify({
              ok: true,
              status: "registration_completed",
              user_id: userId,
              carpark: carpark,
              timestamp: timestamp,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error("Error completing registration:", error)
          await answerCallbackQuery(callbackQuery.id, "Произошла ошибка")
          await sendMessage(chatId, "❌ Произошла ошибка при завершении регистрации. Попробуйте еще раз.")

          return new Response(
            JSON.stringify({
              ok: false,
              error: "Failed to complete registration",
              timestamp: timestamp,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      // Обработка других callback query (подтверждение/отклонение рейсов)
      if (data?.startsWith("confirm_") || data?.startsWith("reject_")) {
        const messageId = Number.parseInt(data.split("_")[1])
        const action = data.startsWith("confirm_") ? "confirmed" : "rejected"

        console.log(`Processing ${action} for message ${messageId}`)

        try {
          const { neon } = await import("@neondatabase/serverless")
          const sql = neon(process.env.DATABASE_URL!)

          await sql`
            UPDATE trip_messages 
            SET response_status = ${action}, 
                response_comment = NULL,
                response_at = ${new Date().toISOString()}
            WHERE id = ${messageId}
          `

          await answerCallbackQuery(callbackQuery.id, action === "confirmed" ? "Рейс подтвержден!" : "Рейс отклонен!")

          const responseMessage =
            action === "confirmed" ? "✅ Спасибо! Рейс подтвержден." : "❌ Рейс отклонен. Спасибо за ответ."

          await sendMessage(chatId, responseMessage)

          console.log(`=== ${action.toUpperCase()} RESPONSE PROCESSED ===`)

          return new Response(
            JSON.stringify({
              ok: true,
              status: `${action}_processed`,
              message_id: messageId,
              timestamp: timestamp,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error(`Error processing ${action}:`, error)
          await answerCallbackQuery(callbackQuery.id, "Произошла ошибка")

          return new Response(
            JSON.stringify({
              ok: false,
              error: `Failed to process ${action}`,
              timestamp: timestamp,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      return new Response(JSON.stringify({ ok: true, status: "callback_ignored" }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    if (!update.message) {
      console.log("No message in update, returning OK")
      return new Response(JSON.stringify({ ok: true, status: "no_message" }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    const message = update.message
    const chatId = message.chat.id
    const userId = message.from.id
    const messageText = message.text

    console.log(`Processing message from user ${userId} (${message.from.first_name}) in chat ${chatId}`)
    console.log(`Message text: "${messageText}"`)

    // Получаем информацию о пользователе
    const existingUser = await getUserByTelegramId(userId)
    console.log("Existing user:", existingUser)

    // Обработка команды /start
    if (messageText === "/start") {
      console.log("=== PROCESSING /START COMMAND ===")

      try {
        const welcomeMessage =
          "🤖 Добро пожаловать в систему уведомлений!\n\n" +
          "Этот бот используется для получения важных сообщений о рейсах.\n\n" +
          "📱 Для регистрации в системе, пожалуйста, поделитесь своим номером телефона."

        console.log("Sending welcome message to chat:", chatId)
        await sendMessage(chatId, welcomeMessage)

        console.log("Sending contact request to chat:", chatId)
        await sendContactRequest(chatId)

        console.log("=== /START COMMAND PROCESSED SUCCESSFULLY ===")

        return new Response(
          JSON.stringify({
            ok: true,
            status: "start_processed",
            timestamp: timestamp,
            user_id: userId,
            chat_id: chatId,
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      } catch (error) {
        console.error("=== ERROR PROCESSING /START ===", error)
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Failed to process start command",
            timestamp: timestamp,
          }),
          {
            status: 500,
            headers: corsHeaders,
          },
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
        console.log(`Creating user in database: ${phone}, ${name}`)
        const user = await createUser(userId, phone, name)
        console.log("User created:", user)

        const firstStepMessage =
          `📝 Отлично! Номер телефона получен.\n\n` +
          `Теперь для завершения регистрации:\n\n` +
          `👤 Пришлите Ваше Имя и Отчество\n` +
          `(например: Иван Петрович)`

        await sendMessage(chatId, firstStepMessage)

        console.log("=== CONTACT PROCESSED, AWAITING FIRST NAME ===")

        return new Response(
          JSON.stringify({
            ok: true,
            status: "contact_processed_awaiting_first_name",
            phone: phone,
            name: name,
            timestamp: timestamp,
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      } catch (error) {
        console.error("=== ERROR PROCESSING CONTACT ===", error)
        await sendMessage(chatId, "❌ Произошла ошибка при регистрации. Попробуйте еще раз.")

        return new Response(
          JSON.stringify({
            ok: false,
            error: "Failed to process contact",
            timestamp: timestamp,
          }),
          {
            status: 500,
            headers: corsHeaders,
          },
        )
      }
    }

    // Обработка текстовых сообщений в зависимости от состояния регистрации
    if (messageText && messageText !== "/start") {
      console.log("=== PROCESSING TEXT MESSAGE ===")

      if (!existingUser) {
        // Пользователь не зарегистрирован
        const helpMessage =
          "👋 Для работы с системой уведомлений необходимо зарегистрироваться.\n\n" +
          "📱 Пожалуйста, поделитесь своим номером телефона, нажав на кнопку ниже."

        await sendMessage(chatId, helpMessage)
        await sendContactRequest(chatId)

        return new Response(
          JSON.stringify({
            ok: true,
            status: "help_sent",
            timestamp: timestamp,
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      // Обработка шагов регистрации
      if (existingUser.registration_state === "awaiting_first_name") {
        console.log("Processing first name input:", messageText)

        try {
          await updateUserRegistrationStep(userId, "first_name", messageText.trim())

          const lastNameMessage =
            `✅ Имя и отчество получены: ${messageText.trim()}\n\n` + `👤 Теперь пришлите Вашу Фамилию`

          await sendMessage(chatId, lastNameMessage)

          return new Response(
            JSON.stringify({
              ok: true,
              status: "first_name_processed",
              first_name: messageText.trim(),
              timestamp: timestamp,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error("Error processing first name:", error)
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")

          return new Response(
            JSON.stringify({
              ok: false,
              error: "Failed to process first name",
              timestamp: timestamp,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      if (existingUser.registration_state === "awaiting_last_name") {
        console.log("Processing last name input:", messageText)

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

          return new Response(
            JSON.stringify({
              ok: true,
              status: "last_name_processed_awaiting_carpark",
              last_name: messageText.trim(),
              timestamp: timestamp,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error("Error processing last name:", error)
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")

          return new Response(
            JSON.stringify({
              ok: false,
              error: "Failed to process last name",
              timestamp: timestamp,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
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

        return new Response(
          JSON.stringify({
            ok: true,
            status: "user_already_registered",
            timestamp: timestamp,
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        )
      }

      // Неизвестное состояние
      await sendMessage(chatId, "❓ Неизвестная команда. Используйте /start для начала работы.")

      return new Response(
        JSON.stringify({
          ok: true,
          status: "unknown_state",
          timestamp: timestamp,
        }),
        {
          status: 200,
          headers: corsHeaders,
        },
      )
    }

    console.log("No specific handler for this message type")
    return new Response(
      JSON.stringify({
        ok: true,
        status: "ignored",
        message_type: message.contact ? "contact" : messageText ? "text" : "other",
        timestamp: timestamp,
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    )
  } catch (error) {
    console.error("=== CRITICAL EDGE FUNCTION WEBHOOK ERROR ===")
    console.error("Error details:", error)

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: timestamp,
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}

export async function GET() {
  console.log("GET request to edge function telegram webhook endpoint")

  return new Response(
    JSON.stringify({
      status: "Edge Function Telegram webhook endpoint is working",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel_url: process.env.VERCEL_URL,
      runtime: "edge",
      public: true,
    }),
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Type": "application/json",
      },
    },
  )
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
