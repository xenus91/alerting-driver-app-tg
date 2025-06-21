import { NextResponse } from "next/server"

export async function GET() {
  try {
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    const webhookUrl = `${appUrl}/api/telegram-webhook`

    console.log("Testing webhook URL:", webhookUrl)

    // Тестируем доступность нового endpoint
    const response = await fetch(webhookUrl, {
      method: "GET",
      headers: {
        "User-Agent": "TelegramBot/1.0",
        Accept: "application/json",
      },
    })

    const responseText = await response.text()
    console.log("Webhook response:", response.status, responseText)

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      webhook_url: webhookUrl,
      response_body: responseText,
      accessible: response.ok,
      message: response.ok ? "✅ Новый webhook endpoint доступен!" : `❌ Webhook недоступен: HTTP ${response.status}`,
    })
  } catch (error) {
    console.error("Test webhook error:", error)
    return NextResponse.json({
      success: false,
      error: "Ошибка при тестировании webhook",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    })
  }
}
