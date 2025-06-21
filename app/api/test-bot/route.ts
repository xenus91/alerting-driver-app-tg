import { NextResponse } from "next/server"

export async function GET() {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        {
          error: "TELEGRAM_BOT_TOKEN не настроен",
        },
        { status: 400 },
      )
    }

    // Получаем информацию о боте
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
    const data = await response.json()

    if (data.ok) {
      return NextResponse.json({
        success: true,
        bot: data.result,
        message: "Бот работает корректно",
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: data.description || "Ошибка при проверке бота",
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Test bot error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при тестировании бота",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
