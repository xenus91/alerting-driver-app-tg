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

    console.log("Clearing webhook updates...")

    // Получаем информацию о текущем webhook
    const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const webhookInfo = await webhookInfoResponse.json()

    console.log("Current webhook info:", webhookInfo)

    // Удаляем webhook с очисткой необработанных обновлений
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
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Устанавливаем webhook заново
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    const webhookUrl = `${appUrl}/api/webhook`

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

    // Проверяем результат
    const finalWebhookResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
    const finalWebhookInfo = await finalWebhookResponse.json()

    return NextResponse.json({
      success: true,
      message: "Webhook обновлен и необработанные обновления очищены",
      before: {
        url: webhookInfo.result?.url || "не установлен",
        pending_updates: webhookInfo.result?.pending_update_count || 0,
      },
      after: {
        url: finalWebhookInfo.result?.url || "не установлен",
        pending_updates: finalWebhookInfo.result?.pending_update_count || 0,
      },
      operations: {
        webhook_deleted: deleteData.ok,
        webhook_set: setData.ok,
      },
    })
  } catch (error) {
    console.error("Clear webhook updates error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при очистке обновлений webhook",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
