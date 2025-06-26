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

⏰ Интервал уведомлений: ${subscription.interval_minutes} мин.

<i>Для отписки перейдите в веб-интерфейс</i>`
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔔 Starting manual notification check...")

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
      message: `Отправлено ${sentCount} уведомлений, ошибок: ${errorCount}`,
    })
  } catch (error) {
    console.error("Error in notification job:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// Автоматическая проверка при GET запросе (для фоновых вызовов)
export async function GET(request: NextRequest) {
  try {
    // Проверяем, прошло ли достаточно времени с последней проверки
    const lastCheck = request.headers.get("x-last-check")
    const now = Date.now()

    if (lastCheck && now - Number.parseInt(lastCheck) < 60000) {
      // Минимум 1 минута между проверками
      return NextResponse.json({ success: true, message: "Too soon for next check" })
    }

    const subscriptions = await getSubscriptionsDueForNotification()

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: "No notifications due" })
    }

    // Если есть уведомления к отправке, отправляем их
    return POST(request)
  } catch (error) {
    console.error("Error in background notification check:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
