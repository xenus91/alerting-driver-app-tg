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

    // Определяем URL приложения
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    const webhookUrl = `${appUrl}/api/webhook`

    console.log("Force updating webhook to:", webhookUrl)

    // Получаем текущую информацию о webhook
    const currentWebhookResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const currentWebhookData = await currentWebhookResponse.json()

    console.log("Current webhook info:", currentWebhookData)

    // Удаляем текущий webhook
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

    // Ждем 2 секунды для обработки
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Устанавливаем новый webhook
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
    console.log("Set webhook response:", setData)

    if (setData.ok) {
      // Проверяем, что webhook установлен правильно
      const verifyResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
      const verifyData = await verifyResponse.json()

      return NextResponse.json({
        success: true,
        message: "Webhook принудительно обновлен!",
        old_webhook: currentWebhookData.result?.url || "не установлен",
        new_webhook: webhookUrl,
        verification: verifyData.result,
        steps_completed: {
          current_webhook_retrieved: currentWebhookResponse.ok,
          old_webhook_deleted: deleteData.ok,
          new_webhook_set: setData.ok,
          webhook_verified: verifyResponse.ok,
        },
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: setData.description || "Ошибка при установке нового webhook",
          old_webhook: currentWebhookData.result?.url || "не установлен",
          attempted_webhook: webhookUrl,
          telegram_response: setData,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Force webhook update error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при принудительном обновлении webhook",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
