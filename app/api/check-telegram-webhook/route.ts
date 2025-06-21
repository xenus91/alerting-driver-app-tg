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

    // Получаем информацию о текущем webhook
    const webhookResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const webhookData = await webhookResponse.json()

    // Получаем информацию о боте
    const botResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
    const botData = await botResponse.json()

    // Определяем наш URL
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    // Тестируем доступность наших endpoints
    const testEndpoints = [
      `${appUrl}/api/test-webhook-access`,
      `${appUrl}/api/webhook-debug`,
      `${appUrl}/webhook/telegram`,
    ]

    const endpointTests = []
    for (const endpoint of testEndpoints) {
      try {
        const testResponse = await fetch(endpoint, {
          method: "GET",
          headers: {
            "User-Agent": "TelegramBot/1.0",
          },
        })
        endpointTests.push({
          url: endpoint,
          status: testResponse.status,
          accessible: testResponse.ok,
          response: testResponse.ok ? await testResponse.text() : `HTTP ${testResponse.status}`,
        })
      } catch (error) {
        endpointTests.push({
          url: endpoint,
          status: 0,
          accessible: false,
          error: error instanceof Error ? error.message : "Network error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      app_url: appUrl,
      bot_info: botData.ok ? botData.result : { error: botData.description },
      webhook_info: webhookData.ok ? webhookData.result : { error: webhookData.description },
      endpoint_tests: endpointTests,
      recommendations: generateRecommendations(webhookData.result, endpointTests, appUrl),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при проверке webhook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function generateRecommendations(webhookInfo: any, endpointTests: any[], appUrl: string) {
  const recommendations = []

  // Проверяем доступность endpoints
  const accessibleEndpoints = endpointTests.filter((test) => test.accessible)
  if (accessibleEndpoints.length === 0) {
    recommendations.push("❌ НИ ОДИН endpoint недоступен - проблема с приложением или DNS")
    recommendations.push("🔧 Проверьте, что приложение развернуто и работает")
    recommendations.push("🔧 Убедитесь, что нет защиты паролем на уровне проекта")
  } else if (accessibleEndpoints.length < endpointTests.length) {
    recommendations.push("⚠️ Некоторые endpoints недоступны")
  } else {
    recommendations.push("✅ Все endpoints доступны")
  }

  // Проверяем webhook URL
  if (webhookInfo?.url) {
    const expectedUrls = [`${appUrl}/api/webhook-debug`, `${appUrl}/webhook/telegram`, `${appUrl}/api/telegram-webhook`]

    if (!expectedUrls.includes(webhookInfo.url)) {
      recommendations.push(`⚠️ Webhook URL не соответствует ожидаемому: ${webhookInfo.url}`)
      recommendations.push("🔧 Настройте webhook на один из рабочих endpoints")
    } else {
      recommendations.push("✅ Webhook URL настроен правильно")
    }
  } else {
    recommendations.push("❌ Webhook не установлен в Telegram")
    recommendations.push("🔧 Установите webhook через диагностику")
  }

  // Проверяем pending updates
  if (webhookInfo?.pending_update_count > 0) {
    recommendations.push(`⚠️ ${webhookInfo.pending_update_count} необработанных обновлений`)
    recommendations.push("🔧 Очистите обновления через 'Очистить обновления'")
  }

  // Проверяем allowed_updates
  if (webhookInfo?.allowed_updates && !webhookInfo.allowed_updates.includes("callback_query")) {
    recommendations.push("❌ callback_query не включен в allowed_updates")
    recommendations.push("🔧 Переустановите webhook с правильными allowed_updates")
  }

  return recommendations
}
