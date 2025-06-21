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

    // Получаем информацию о webhook
    const webhookResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const webhookData = await webhookResponse.json()

    // Получаем информацию о боте
    const botResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
    const botData = await botResponse.json()

    // Получаем обновления (если есть)
    const updatesResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=5`)
    const updatesData = await updatesResponse.json()

    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    return NextResponse.json({
      success: true,
      app_url: appUrl,
      expected_webhook: `${appUrl}/api/telegram-webhook`,
      bot_info: botData.ok ? botData.result : null,
      webhook_info: webhookData.ok ? webhookData.result : null,
      recent_updates: updatesData.ok ? updatesData.result : null,
      webhook_accessible: false, // Будем проверять отдельно
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Webhook info error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении информации о webhook",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
