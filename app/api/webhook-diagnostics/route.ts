import { NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function GET() {
  try {
    // Получаем информацию о webhook
    const webhookResponse = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`)
    const webhookData = await webhookResponse.json()

    // Получаем текущий URL приложения
    const currentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

    const expectedWebhookUrl = `${currentUrl}/api/telegram-webhook`

    return NextResponse.json({
      current_app_url: currentUrl,
      expected_webhook_url: expectedWebhookUrl,
      actual_webhook_info: webhookData.result,
      webhook_matches: webhookData.result?.url === expectedWebhookUrl,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to get webhook diagnostics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    console.log("=== FORCE FIXING WEBHOOK URL ===")

    // Получаем правильный URL
    const currentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

    const correctWebhookUrl = `${currentUrl}/api/telegram-webhook`

    console.log("Current URL:", currentUrl)
    console.log("Setting webhook to:", correctWebhookUrl)

    // Сначала удаляем webhook
    const deleteResponse = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`, {
      method: "POST",
    })

    const deleteResult = await deleteResponse.json()
    console.log("Delete webhook result:", deleteResult)

    // Ждем 2 секунды
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Устанавливаем новый webhook
    const setResponse = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: correctWebhookUrl,
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query"], // ДОБАВЛЯЕМ callback_query!
      }),
    })

    const setResult = await setResponse.json()
    console.log("Set webhook result:", setResult)

    // Проверяем результат
    const checkResponse = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`)
    const checkResult = await checkResponse.json()

    console.log("Final webhook info:", checkResult.result)

    return NextResponse.json({
      success: setResult.ok,
      delete_result: deleteResult,
      set_result: setResult,
      final_webhook_info: checkResult.result,
      correct_url: correctWebhookUrl,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fixing webhook:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
