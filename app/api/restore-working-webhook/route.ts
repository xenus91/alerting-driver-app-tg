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

    // Используем публичный webhook endpoint, который точно работает
    const webhookUrl = `${appUrl}/webhook/telegram`

    console.log("=== RESTORING WORKING WEBHOOK ===")
    console.log("Setting webhook to:", webhookUrl)

    try {
      // Удаляем debug webhook
      const deleteResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      })
      const deleteData = await deleteResponse.json()
      console.log("Delete debug webhook:", deleteData)

      // Ждем немного
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Устанавливаем рабочий webhook
      const setResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"], // ВАЖНО: включаем callback_query
          drop_pending_updates: true,
          max_connections: 40,
        }),
      })
      const setData = await setResponse.json()
      console.log("Set working webhook:", setData)

      if (setData.ok) {
        // Проверяем результат
        const verifyResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`)
        const verifyData = await verifyResponse.json()

        return NextResponse.json({
          success: true,
          message: "✅ Рабочий webhook восстановлен! Теперь кнопки должны работать.",
          webhook_url: webhookUrl,
          verification: verifyData.result,
          next_steps: [
            "1. Нажмите кнопку в боте еще раз",
            "2. Проверьте, что приходит уведомление пользователю",
            "3. Проверьте логи в Vercel Dashboard",
            "4. Убедитесь, что ответ сохраняется в базе данных",
          ],
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: setData.description || "Ошибка при установке рабочего webhook",
            telegram_response: setData,
          },
          { status: 400 },
        )
      }
    } catch (fetchError) {
      console.error("Fetch error:", fetchError)
      return NextResponse.json(
        {
          success: false,
          error: "Не удалось подключиться к Telegram API",
          details: fetchError instanceof Error ? fetchError.message : "Unknown error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Restore webhook error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при восстановлении webhook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
