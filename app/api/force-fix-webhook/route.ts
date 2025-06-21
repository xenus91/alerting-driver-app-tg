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

    console.log("=== FORCE FIX WEBHOOK ===")
    console.log("App URL:", appUrl)

    const steps = []

    // Шаг 1: Полностью удаляем webhook
    try {
      console.log("Step 1: Deleting webhook...")
      const deleteResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      })
      const deleteData = await deleteResponse.json()
      steps.push({ step: "delete_webhook", success: deleteResponse.ok, data: deleteData })
      console.log("Delete result:", deleteData)
    } catch (error) {
      steps.push({ step: "delete_webhook", success: false, error: error instanceof Error ? error.message : "Unknown" })
    }

    // Шаг 2: Ждем 5 секунд
    console.log("Step 2: Waiting 5 seconds...")
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Шаг 3: Тестируем все наши endpoints
    const testEndpoints = [
      `${appUrl}/api/test-webhook-access`,
      `${appUrl}/webhook/telegram`,
      `${appUrl}/api/webhook-debug`,
    ]

    let workingEndpoint = null
    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint}`)
        const testResponse = await fetch(endpoint, {
          method: "GET",
          headers: { "User-Agent": "TelegramBot/1.0" },
        })

        if (testResponse.ok) {
          workingEndpoint = endpoint
          console.log(`✅ Working endpoint found: ${endpoint}`)
          break
        } else {
          console.log(`❌ Endpoint failed: ${endpoint} - HTTP ${testResponse.status}`)
        }
      } catch (error) {
        console.log(`❌ Endpoint error: ${endpoint} - ${error}`)
      }
    }

    steps.push({
      step: "test_endpoints",
      success: !!workingEndpoint,
      working_endpoint: workingEndpoint,
      tested_endpoints: testEndpoints,
    })

    if (!workingEndpoint) {
      return NextResponse.json({
        success: false,
        error: "НИ ОДИН endpoint недоступен! Проблема с приложением.",
        steps: steps,
        recommendations: [
          "1. Проверьте, что приложение развернуто на Vercel",
          "2. Убедитесь, что нет защиты паролем",
          "3. Проверьте настройки безопасности проекта",
          "4. Попробуйте переразвернуть приложение",
        ],
      })
    }

    // Шаг 4: Устанавливаем webhook на рабочий endpoint
    try {
      console.log(`Step 4: Setting webhook to ${workingEndpoint}`)
      const setResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: workingEndpoint,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
          max_connections: 40,
        }),
      })
      const setData = await setResponse.json()
      steps.push({ step: "set_webhook", success: setResponse.ok, data: setData })
      console.log("Set webhook result:", setData)
    } catch (error) {
      steps.push({ step: "set_webhook", success: false, error: error instanceof Error ? error.message : "Unknown" })
    }

    // Шаг 5: Проверяем результат
    try {
      console.log("Step 5: Verifying webhook...")
      const verifyResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
      const verifyData = await verifyResponse.json()
      steps.push({ step: "verify_webhook", success: verifyResponse.ok, data: verifyData })
      console.log("Verify result:", verifyData)
    } catch (error) {
      steps.push({ step: "verify_webhook", success: false, error: error instanceof Error ? error.message : "Unknown" })
    }

    const allSuccess = steps.every((step) => step.success)

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? `✅ Webhook успешно настроен на ${workingEndpoint}!`
        : "❌ Некоторые шаги завершились с ошибками",
      working_endpoint: workingEndpoint,
      steps: steps,
      next_actions: allSuccess
        ? [
            "1. Отправьте /start боту",
            "2. Отправьте тестовое сообщение с кнопками",
            "3. Нажмите кнопки и проверьте логи",
            "4. Проверьте, что приходят уведомления",
          ]
        : ["1. Проверьте логи выше", "2. Убедитесь, что приложение доступно", "3. Попробуйте переразвернуть на Vercel"],
    })
  } catch (error) {
    console.error("Force fix webhook error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Критическая ошибка при исправлении webhook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
