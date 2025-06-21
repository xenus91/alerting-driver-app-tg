import { NextResponse } from "next/server"

export async function POST() {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: "TELEGRAM_BOT_TOKEN не настроен в переменных окружения",
          instructions: [
            "1. Создайте бота через @BotFather в Telegram",
            "2. Получите токен бота (формат: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz)",
            "3. Добавьте TELEGRAM_BOT_TOKEN в переменные окружения",
          ],
        },
        { status: 400 },
      )
    }

    // Определяем URL приложения
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL
        ? process.env.NEXTAUTH_URL
        : "http://localhost:3000"

    const webhookUrl = `${appUrl}/api/webhook`

    console.log("Setting webhook to:", webhookUrl)

    try {
      // Сначала удаляем старый webhook
      const deleteResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
        method: "POST",
      })
      const deleteData = await deleteResponse.json()
      console.log("Delete webhook response:", deleteData)

      // Ждем немного перед установкой нового
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Устанавливаем новый webhook
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: webhookUrl,
          drop_pending_updates: true,
          allowed_updates: ["message"],
          max_connections: 40,
          secret_token: undefined, // Убираем secret token для упрощения
        }),
      })

      const data = await response.json()
      console.log("Webhook setup response:", data)

      if (data.ok) {
        return NextResponse.json({
          success: true,
          message: "Webhook успешно настроен! Теперь отправьте /start боту для проверки.",
          url: webhookUrl,
          details: data.description,
          old_webhook_deleted: deleteData.ok,
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: data.description || "Ошибка при настройке webhook",
            code: data.error_code,
            telegram_response: data,
            webhook_url: webhookUrl,
          },
          { status: 400 },
        )
      }
    } catch (fetchError) {
      console.error("Fetch error:", fetchError)
      return NextResponse.json(
        {
          success: false,
          error: "Не удалось подключиться к Telegram API",
          details: "Проверьте интернет соединение и правильность токена",
          technical_details: fetchError instanceof Error ? fetchError.message : "Unknown fetch error",
          webhook_url: webhookUrl,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Setup webhook error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Внутренняя ошибка сервера",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

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

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const data = await response.json()

    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL
        ? process.env.NEXTAUTH_URL
        : "http://localhost:3000"

    return NextResponse.json({
      ...data,
      expected_url: `${appUrl}/api/webhook`,
    })
  } catch (error) {
    console.error("Get webhook info error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении информации о webhook",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
