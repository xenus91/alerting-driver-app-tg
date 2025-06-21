import { NextResponse } from "next/server"
import { getAppUrl } from "@/lib/app-config"

export async function GET() {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({
        success: false,
        error: "TELEGRAM_BOT_TOKEN не настроен в переменных окружения",
        steps: [
          "1. Откройте Telegram и найдите @BotFather",
          "2. Отправьте команду /newbot",
          "3. Следуйте инструкциям для создания бота",
          "4. Скопируйте полученный токен",
          "5. Добавьте TELEGRAM_BOT_TOKEN в переменные окружения Vercel",
        ],
        example_token: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
      })
    }

    const appUrl = getAppUrl()
    const expectedWebhookUrl = `${appUrl}/api/telegram-webhook`
    const isLocalDevelopment = process.env.NODE_ENV === "development"
    const isLiteEnvironment = appUrl.includes("lite.vusercontent.net")
    const isVercelDeployment = !!process.env.VERCEL_URL

    // Проверяем доступность webhook health endpoint
    let webhookAccessible = false
    let healthCheckError = null

    try {
      const healthUrl = `${appUrl}/api/telegram-webhook`
      const testResponse = await fetch(healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })
      webhookAccessible = testResponse.ok

      if (!testResponse.ok) {
        healthCheckError = `HTTP ${testResponse.status}: ${testResponse.statusText}`

        // Попробуем проверить основной webhook endpoint
        try {
          const webhookResponse = await fetch(expectedWebhookUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          })
          if (webhookResponse.ok) {
            webhookAccessible = true
            healthCheckError = null
          }
        } catch (webhookError) {
          // Игнорируем ошибку, используем результат health check
        }
      }
    } catch (error) {
      webhookAccessible = false
      healthCheckError = error instanceof Error ? error.message : "Network error"

      // Попробуем проверить основной webhook endpoint как fallback
      try {
        const webhookResponse = await fetch(expectedWebhookUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        })
        if (webhookResponse.ok) {
          webhookAccessible = true
          healthCheckError = "Health endpoint недоступен, но webhook работает"
        }
      } catch (webhookError) {
        // Оставляем исходную ошибку
      }
    }

    // Проверяем текущий webhook в Telegram
    let currentTelegramWebhook = null
    let telegramWebhookError = null

    try {
      const webhookResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
      const webhookData = await webhookResponse.json()

      if (webhookData.ok) {
        currentTelegramWebhook = webhookData.result
      } else {
        telegramWebhookError = webhookData.description
      }
    } catch (error) {
      telegramWebhookError = "Не удалось получить информацию о webhook"
    }

    const recommendations = []

    if (isLiteEnvironment) {
      recommendations.push("❌ Lite environment не поддерживает Telegram webhook")
      recommendations.push("💡 Разверните приложение на Vercel")
    } else if (isLocalDevelopment) {
      recommendations.push("⚠️ Локальная разработка - webhook недоступен для Telegram")
      recommendations.push("💡 Используйте ngrok для тестирования")
    } else if (!isVercelDeployment) {
      recommendations.push("⚠️ Не обнаружено развертывание на Vercel")
      recommendations.push("💡 Убедитесь, что VERCEL_URL установлен")
    } else if (!webhookAccessible) {
      recommendations.push("❌ Webhook URL недоступен")
      recommendations.push("🔍 Проверьте доступность приложения")
      if (healthCheckError) {
        recommendations.push(`🔧 Ошибка: ${healthCheckError}`)
      }
    } else if (currentTelegramWebhook?.url !== expectedWebhookUrl) {
      recommendations.push("⚠️ Webhook в Telegram настроен неправильно")
      recommendations.push("🔧 Нажмите 'Настроить webhook' для обновления")
    } else {
      recommendations.push("✅ Приложение развернуто на Vercel")
      recommendations.push("✅ Webhook URL доступен")
      recommendations.push("✅ Webhook настроен правильно")
      recommendations.push("💡 Протестируйте бота командой /start")
    }

    return NextResponse.json({
      success: true,
      token_configured: true,
      token_format_valid: TELEGRAM_BOT_TOKEN.includes(":") && TELEGRAM_BOT_TOKEN.length > 20,
      webhook_accessible: webhookAccessible,
      is_lite_environment: isLiteEnvironment,
      is_local_development: isLocalDevelopment,
      is_vercel_deployment: isVercelDeployment,
      health_check_error: healthCheckError,
      telegram_webhook_error: telegramWebhookError,
      current_telegram_webhook: currentTelegramWebhook,
      environment: {
        app_url: appUrl,
        expected_webhook_url: expectedWebhookUrl,
        node_env: process.env.NODE_ENV,
        vercel_url: process.env.VERCEL_URL || "не установлен",
        nextauth_url: process.env.NEXTAUTH_URL || "не установлен",
      },
      recommendations,
    })
  } catch (error) {
    console.error("Bot diagnostics error:", error)
    return NextResponse.json({
      success: false,
      error: "Ошибка при диагностике бота",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    })
  }
}
