import { NextResponse } from "next/server"

export async function POST() {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: "TELEGRAM_BOT_TOKEN не настроен в переменных окружения",
        },
        { status: 400 },
      )
    }

    // Определяем URL приложения
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    // Используем Edge Function endpoint
    const webhookUrl = `${appUrl}/api/tg-edge`

    console.log("Setting EDGE FUNCTION Telegram webhook to:", webhookUrl)

    try {
      // Удаляем старый webhook
      const deleteResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          drop_pending_updates: true,
        }),
      })

      const deleteData = await deleteResponse.json()
      console.log("Delete webhook response:", deleteData)

      // Ждем немного
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Тестируем доступность Edge Function endpoint
      let endpointAccessible = false
      try {
        const testResponse = await fetch(webhookUrl, {
          method: "GET",
          headers: {
            "User-Agent": "TelegramBot/1.0",
            Accept: "application/json",
          },
        })
        endpointAccessible = testResponse.ok
        console.log("Edge Function endpoint test:", testResponse.status, testResponse.ok)
      } catch (testError) {
        console.log("Edge Function endpoint test failed:", testError)
      }

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
        }),
      })

      const data = await response.json()
      console.log("Edge Function webhook setup response:", data)

      if (data.ok) {
        // Проверяем установку
        const verifyResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
        const verifyData = await verifyResponse.json()

        return NextResponse.json({
          success: true,
          message: "Edge Function Telegram webhook успешно настроен!",
          url: webhookUrl,
          details: data.description,
          old_webhook_deleted: deleteData.ok,
          endpoint_accessible: endpointAccessible,
          verification: verifyData.result,
          runtime: "edge",
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: data.description || "Ошибка при настройке Edge Function webhook",
            code: data.error_code,
            telegram_response: data,
            webhook_url: webhookUrl,
            endpoint_accessible: endpointAccessible,
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
    console.error("Setup edge webhook error:", error)
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
