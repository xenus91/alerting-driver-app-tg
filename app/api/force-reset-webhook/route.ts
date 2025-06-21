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

    const webhookUrl = `${appUrl}/api/telegram-webhook`

    console.log("=== FORCE RESET WEBHOOK ===")
    console.log("App URL:", appUrl)
    console.log("Webhook URL:", webhookUrl)

    const steps = []

    // Шаг 1: Получаем текущую информацию
    try {
      const currentResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
      const currentData = await currentResponse.json()
      steps.push({
        step: "get_current_webhook",
        success: currentResponse.ok,
        data: currentData,
      })
      console.log("Current webhook:", currentData)
    } catch (error) {
      steps.push({
        step: "get_current_webhook",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Шаг 2: Удаляем webhook полностью
    try {
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
      steps.push({
        step: "delete_webhook",
        success: deleteResponse.ok,
        data: deleteData,
      })
      console.log("Delete webhook:", deleteData)
    } catch (error) {
      steps.push({
        step: "delete_webhook",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Шаг 3: Ждем 5 секунд
    console.log("Waiting 5 seconds...")
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Шаг 4: Проверяем доступность нашего endpoint
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
      steps.push({
        step: "test_endpoint",
        success: testResponse.ok,
        status: testResponse.status,
        url: webhookUrl,
      })
      console.log("Endpoint test:", testResponse.status, testResponse.ok)
    } catch (error) {
      steps.push({
        step: "test_endpoint",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        url: webhookUrl,
      })
    }

    // Шаг 5: Устанавливаем новый webhook
    try {
      const setResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
          drop_pending_updates: true,
          max_connections: 40,
        }),
      })

      const setData = await setResponse.json()
      steps.push({
        step: "set_webhook",
        success: setResponse.ok,
        data: setData,
      })
      console.log("Set webhook:", setData)
    } catch (error) {
      steps.push({
        step: "set_webhook",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Шаг 6: Проверяем результат
    try {
      const verifyResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
      const verifyData = await verifyResponse.json()
      steps.push({
        step: "verify_webhook",
        success: verifyResponse.ok,
        data: verifyData,
      })
      console.log("Verify webhook:", verifyData)
    } catch (error) {
      steps.push({
        step: "verify_webhook",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    console.log("=== FORCE RESET COMPLETE ===")

    const allStepsSuccessful = steps.every((step) => step.success)

    return NextResponse.json({
      success: allStepsSuccessful,
      message: allStepsSuccessful
        ? "Webhook принудительно сброшен и переустановлен!"
        : "Некоторые шаги завершились с ошибками",
      webhook_url: webhookUrl,
      endpoint_accessible: endpointAccessible,
      steps: steps,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Force reset webhook error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Критическая ошибка при сбросе webhook",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
