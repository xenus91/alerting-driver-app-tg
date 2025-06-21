import { type NextRequest, NextResponse } from "next/server"
import type { TelegramUpdate } from "@/lib/telegram"
import { createUser } from "@/lib/database"
import { sendMessage, sendContactRequest } from "@/lib/telegram"

// Отключаем кеширование для webhook
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`=== WEBHOOK RECEIVED at ${timestamp} ===`)

  // Добавляем CORS заголовки
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  try {
    // Проверяем, что запрос от Telegram
    const userAgent = request.headers.get("user-agent") || ""
    console.log("User-Agent:", userAgent)
    console.log("Request headers:", Object.fromEntries(request.headers.entries()))

    const update: TelegramUpdate = await request.json()
    console.log("Update data:", JSON.stringify(update, null, 2))

    if (!update.message) {
      console.log("No message in update, skipping")
      return NextResponse.json({ ok: true, status: "no_message" }, { headers })
    }

    const message = update.message
    const chatId = message.chat.id
    const userId = message.from.id
    const messageText = message.text

    console.log(`Processing message from user ${userId} (${message.from.first_name}) in chat ${chatId}`)
    console.log(`Message text: "${messageText}"`)

    // Обработка команды /start
    if (messageText === "/start") {
      console.log("Processing /start command")

      try {
        const welcomeMessage =
          "🤖 Добро пожаловать в систему уведомлений!\n\n" +
          "Этот бот используется для получения важных сообщений.\n\n" +
          "📱 Для регистрации в системе, пожалуйста, поделитесь своим номером телефона."

        console.log("Sending welcome message...")
        await sendMessage(chatId, welcomeMessage)
        console.log("Welcome message sent successfully")

        console.log("Sending contact request...")
        await sendContactRequest(chatId)
        console.log("Contact request sent successfully")

        return NextResponse.json(
          {
            ok: true,
            status: "start_processed",
            timestamp: timestamp,
            user_id: userId,
            chat_id: chatId,
          },
          { headers },
        )
      } catch (error) {
        console.error("Error processing /start:", error)
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

        try {
          await sendMessage(chatId, "❌ Произошла ошибка. Попробуйте еще раз.")
        } catch (sendError) {
          console.error("Error sending error message:", sendError)
        }

        return NextResponse.json(
          {
            ok: false,
            error: "Failed to process start command",
            details: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          },
          { status: 500, headers },
        )
      }
    }

    // Обработка контакта
    if (message.contact) {
      console.log("Processing contact:", message.contact)

      const phone = message.contact.phone_number
      const name = `${message.contact.first_name} ${message.contact.last_name || ""}`.trim()

      try {
        console.log(`Creating user: ${phone}, ${name}`)
        await createUser(userId, phone, name)

        const successMessage =
          `✅ Отлично! Вы успешно зарегистрированы в системе.\n\n` +
          `📱 Ваш номер: ${phone}\n` +
          `👤 Имя: ${name}\n\n` +
          `Теперь вы будете получать важные уведомления через этого бота.`

        await sendMessage(chatId, successMessage)
        console.log(`User registered successfully: ${phone}`)

        return NextResponse.json(
          {
            ok: true,
            status: "user_registered",
            phone: phone,
            timestamp: timestamp,
          },
          { headers },
        )
      } catch (error) {
        console.error("Error saving user:", error)
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

        try {
          await sendMessage(
            chatId,
            "❌ Произошла ошибка при регистрации. Пожалуйста, попробуйте еще раз или обратитесь к администратору.",
          )
        } catch (sendError) {
          console.error("Error sending error message:", sendError)
        }

        return NextResponse.json(
          {
            ok: false,
            error: "Failed to register user",
            details: error instanceof Error ? error.message : "Unknown error",
            timestamp: timestamp,
          },
          { status: 500, headers },
        )
      }
    }

    // Обработка обычных сообщений
    if (messageText && messageText !== "/start") {
      console.log("Processing regular text message")

      try {
        const helpMessage =
          "👋 Для работы с системой уведомлений необходимо зарегистрироваться.\n\n" +
          "📱 Пожалуйста, поделитесь своим номером телефона, нажав на кнопку ниже."

        await sendMessage(chatId, helpMessage)
        await sendContactRequest(chatId)

        return NextResponse.json(
          {
            ok: true,
            status: "help_sent",
            timestamp: timestamp,
          },
          { headers },
        )
      } catch (error) {
        console.error("Error sending help message:", error)
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to send help",
            timestamp: timestamp,
          },
          { status: 500, headers },
        )
      }
    }

    console.log("No specific handler for this message type")
    return NextResponse.json(
      {
        ok: true,
        status: "ignored",
        message_type: message.contact ? "contact" : messageText ? "text" : "other",
        timestamp: timestamp,
      },
      { headers },
    )
  } catch (error) {
    console.error("=== WEBHOOK ERROR ===")
    console.error("Error details:", error)
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace")
    console.error("Request method:", request.method)
    console.error("Request URL:", request.url)

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: timestamp,
      },
      { status: 500, headers },
    )
  }
}

// Добавляем GET метод для проверки
export async function GET(request: NextRequest) {
  console.log("GET request to webhook endpoint")
  console.log("Headers:", Object.fromEntries(request.headers.entries()))

  return NextResponse.json(
    {
      status: "Webhook endpoint is working",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel_url: process.env.VERCEL_URL,
      method: "GET",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  )
}

// Добавляем OPTIONS для CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
