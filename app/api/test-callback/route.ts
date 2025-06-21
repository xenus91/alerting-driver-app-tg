import { type NextRequest, NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json()

    console.log("=== SENDING TEST CALLBACK MESSAGE ===")
    console.log("Chat ID:", chatId)

    const testMessage = "🧪 Тест callback query\n\nНажмите кнопку ниже для проверки работы callback_query:"

    const testButtons = [
      [
        {
          text: "🔘 Тест callback",
          callback_data: "test_callback_123",
        },
      ],
    ]

    const payload = {
      chat_id: chatId,
      text: testMessage,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: testButtons,
      },
    }

    console.log("Sending test payload:", JSON.stringify(payload, null, 2))

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
      throw new Error(data.description || "Failed to send test message")
    }

    console.log("=== TEST CALLBACK MESSAGE SENT SUCCESSFULLY ===")

    return NextResponse.json({
      success: true,
      message: "Тестовое сообщение с кнопкой отправлено",
      telegram_response: data.result,
    })
  } catch (error) {
    console.error("Error sending test callback message:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
