import { type NextRequest, NextResponse } from "next/server"
import { getSubscriptionsDueForNotification, updateSubscriptionLastNotification } from "@/lib/database"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

async function sendTelegramMessage(chatId: number, message: string) {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return data
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    throw error
  }
}

function formatNotificationMessage(subscription: any) {
  const confirmedNum = Number(subscription.confirmed_responses)
  const rejectedNum = Number(subscription.rejected_responses)
  const pendingNum = Number(subscription.pending_responses)
  const sentNum = Number(subscription.sent_messages)

  const responsePercentage = sentNum > 0 ? Math.round(((confirmedNum + rejectedNum) / sentNum) * 100) : 0

  const userName = subscription.full_name || subscription.first_name || "Пользователь"

  return `🔔 <b>Уведомление о рассылке #${subscription.trip_id}</b>

👋 Привет, ${userName}!

📊 <b>Текущий статус:</b>
• Отправлено: ${sentNum} сообщений
• Подтверждено: ✅ ${confirmedNum}
• Отклонено: ❌ ${rejectedNum}
• Ожидают ответа: ⏳ ${pendingNum}

📈 <b>Прогресс ответов:</b> ${responsePercentage}%

⏰ Следующее уведомление через ${subscription.interval_minutes} мин.

<i>Для отписки перейдите в веб-интерфейс</i>`
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию для cron job
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("🔔 Starting notification check...")

    const subscriptions = await getSubscriptionsDueForNotification()
    console.log(`Found ${subscriptions.length} subscriptions due for notification`)

    let sentCount = 0
    let errorCount = 0

    for (const subscription of subscriptions) {
      try {
        const message = formatNotificationMessage(subscription)

        console.log(`Sending notification to user ${subscription.telegram_id} for trip ${subscription.trip_id}`)

        await sendTelegramMessage(subscription.telegram_id, message)
        await updateSubscriptionLastNotification(subscription.id)

        sentCount++
        console.log(`✅ Notification sent successfully`)

        // Небольшая задержка между отправками
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`❌ Error sending notification to user ${subscription.telegram_id}:`, error)
        errorCount++
      }
    }

    console.log(`🔔 Notification check completed: ${sentCount} sent, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      total: subscriptions.length,
    })
  } catch (error) {
    console.error("Error in notification cron job:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// Для тестирования можно также добавить POST метод
export async function POST(request: NextRequest) {
  return GET(request)
}
