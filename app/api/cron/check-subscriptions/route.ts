import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// Функция отправки сообщения в Telegram
async function sendTelegramMessage(chatId: string, message: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured")
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("Telegram API error:", result)
      return { success: false, error: result.description || "Failed to send message" }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию через секретный ключ
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET_KEY

    if (!cronSecret) {
      console.error("CRON_SECRET_KEY not configured")
      return NextResponse.json({ success: false, error: "Cron secret not configured" }, { status: 500 })
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.error("Unauthorized cron request")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("=== CRON: CHECKING SUBSCRIPTIONS ===")

    // Получаем все активные подписки, которые нужно проверить
    // Проверяем только те, где прошло достаточно времени с последнего уведомления
    const subscriptions = await sql`
      SELECT 
        ts.*,
        t.status as trip_status,
        t.created_at as trip_created_at,
        COUNT(tm.id) as total_messages,
        COUNT(CASE WHEN tm.status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN tm.status = 'error' THEN 1 END) as error_messages,
        COUNT(CASE WHEN tm.response_status = 'confirmed' THEN 1 END) as confirmed_responses,
        COUNT(CASE WHEN tm.response_status = 'rejected' THEN 1 END) as rejected_responses,
        COUNT(CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN 1 END) as pending_responses
      FROM trip_subscriptions ts
      JOIN trips t ON ts.trip_id = t.id
      LEFT JOIN trip_messages tm ON t.id = tm.trip_id
      WHERE ts.is_active = true
        AND t.status != 'completed'
        AND (
          ts.last_notification_at IS NULL 
          OR ts.last_notification_at <= NOW() - INTERVAL '1 minute' * ts.interval_minutes
        )
      GROUP BY ts.id, t.id, t.status, t.created_at
    `

    console.log(`CRON: Found ${subscriptions.length} subscriptions to check`)

    let notificationsSent = 0
    let subscriptionsCompleted = 0
    let errors = 0

    for (const subscription of subscriptions) {
      try {
        const totalMessages = Number(subscription.total_messages)
        const sentMessages = Number(subscription.sent_messages)
        const errorMessages = Number(subscription.error_messages)
        const confirmedResponses = Number(subscription.confirmed_responses)
        const rejectedResponses = Number(subscription.rejected_responses)
        const pendingResponses = Number(subscription.pending_responses)

        const totalResponses = confirmedResponses + rejectedResponses
        const responsePercentage = sentMessages > 0 ? Math.round((totalResponses / sentMessages) * 100) : 0
        const sentPercentage = totalMessages > 0 ? Math.round((sentMessages / totalMessages) * 100) : 0

        // Формируем сообщение с прогрессом
        let message = `📊 <b>Прогресс рассылки #${subscription.trip_id}</b>\n\n`

        message += `📤 <b>Отправка:</b> ${sentMessages}/${totalMessages} (${sentPercentage}%)\n`
        message += `📥 <b>Ответы:</b> ${totalResponses}/${sentMessages} (${responsePercentage}%)\n\n`

        message += `✅ Подтверждено: ${confirmedResponses}\n`
        message += `❌ Отклонено: ${rejectedResponses}\n`
        message += `⏳ Ожидают: ${pendingResponses}\n`

        if (errorMessages > 0) {
          message += `🚫 Ошибки: ${errorMessages}\n`
        }

        message += `\n`

        // Определяем статус и завершаем ли подписку
        let shouldCompleteSubscription = false

        if (totalResponses === sentMessages && sentMessages === totalMessages && totalMessages > 0) {
          message += `🎉 <b>Рассылка завершена!</b>\n`
          message += `Все водители ответили. Подписка автоматически отменена.`
          shouldCompleteSubscription = true
        } else if (sentMessages < totalMessages) {
          message += `🚀 Рассылка в процессе отправки...`
        } else if (pendingResponses > 0) {
          message += `⏰ Ожидаем ответы от ${pendingResponses} водителей...`
        } else {
          message += `📋 Статус рассылки обновлен`
        }

        // Добавляем ссылку на просмотр рассылки
        message += `\n\n🔗 <a href="https://v0-tg-bot-allerting.vercel.app/trips/${subscription.trip_id}">Посмотреть детали рассылки</a>`

        // Отправляем уведомление
        const telegramResult = await sendTelegramMessage(subscription.user_telegram_id, message)

        if (telegramResult.success) {
          // Обновляем время последнего уведомления
          await sql`
            UPDATE trip_subscriptions 
            SET last_notification_at = CURRENT_TIMESTAMP
            WHERE id = ${subscription.id}
          `

          notificationsSent++
          console.log(
            `CRON: Sent notification for subscription ${subscription.id} to user ${subscription.user_telegram_id}`,
          )

          // Если рассылка завершена, удаляем подписку
          if (shouldCompleteSubscription) {
            await sql`
              DELETE FROM trip_subscriptions 
              WHERE id = ${subscription.id}
            `

            // Обновляем статус рассылки
            await sql`
              UPDATE trips 
              SET status = 'completed'
              WHERE id = ${subscription.trip_id}
            `

            subscriptionsCompleted++
            console.log(`CRON: Completed and removed subscription ${subscription.id}`)
          }
        } else {
          errors++
          console.error(`CRON: Failed to send notification for subscription ${subscription.id}:`, telegramResult.error)
        }
      } catch (error) {
        errors++
        console.error(`CRON: Error processing subscription ${subscription.id}:`, error)
      }
    }

    console.log(
      `=== CRON: COMPLETED - ${notificationsSent} notifications sent, ${subscriptionsCompleted} subscriptions completed, ${errors} errors ===`,
    )

    return NextResponse.json({
      success: true,
      checked: subscriptions.length,
      sent: notificationsSent,
      completed: subscriptionsCompleted,
      errors: errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("CRON: Error checking subscriptions:", error)
    return NextResponse.json({ success: false, error: "Failed to check subscriptions" }, { status: 500 })
  }
}

// Также поддерживаем GET для простой проверки
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET_KEY

  if (!cronSecret) {
    return NextResponse.json({ success: false, error: "Cron secret not configured" }, { status: 500 })
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    message: "Cron endpoint is working",
    timestamp: new Date().toISOString(),
  })
}
