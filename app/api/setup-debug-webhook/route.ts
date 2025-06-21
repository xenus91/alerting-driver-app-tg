import { NextResponse } from "next/server"

export async function POST() {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: "TELEGRAM_BOT_TOKEN не настроен",
        },
        { status: 400 },
      )
    }

    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    const webhookUrl = `${appUrl}/api/webhook-debug`

    console.log("Setting DEBUG webhook to:", webhookUrl)

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

    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Устанавливаем debug webhook
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query"],
        max_connections: 40,
      }),
    })

    const data = await response.json()

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: "Debug webhook установлен! Теперь нажмите кнопки в боте и проверьте логи.",
        url: webhookUrl,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: data.description || "Ошибка при настройке debug webhook",
          telegram_response: data,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Setup debug webhook error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при настройке debug webhook",
      },
      { status: 500 },
    )
  }
}
