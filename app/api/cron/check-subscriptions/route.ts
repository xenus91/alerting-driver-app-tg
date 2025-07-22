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
    const authHeader = request.headers.get("x-cron-secret")
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
    const subscriptions = await sql`
      SELECT 
        ts.*,
        t.status as trip_status,
        t.created_at as trip_created_at,
        COUNT(DISTINCT u.telegram_id) AS total_users,
        COUNT(DISTINCT CASE WHEN tm.status = 'sent' THEN u.telegram_id END) AS sent_users,
        COUNT(DISTINCT CASE WHEN tm.status = 'error' THEN u.telegram_id END) AS error_users,
        COUNT(DISTINCT CASE WHEN tm.response_status = 'confirmed' THEN u.telegram_id END) AS confirmed_users,
        COUNT(DISTINCT CASE WHEN tm.response_status = 'rejected' THEN u.telegram_id END) AS rejected_users,
        COUNT(DISTINCT CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN u.telegram_id END) AS pending_users,
        COUNT(DISTINCT CASE WHEN tm.response_status = 'declined' THEN u.telegram_id END) AS declined_users
      FROM trip_subscriptions ts
      JOIN trips t ON ts.trip_id = t.id
      LEFT JOIN trip_messages tm ON t.id = tm.trip_id
      LEFT JOIN users u ON tm.phone = u.phone
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
        const totalUsers = Number(subscription.total_users)
        const sentUsers = Number(subscription.sent_users)
        const errorUsers = Number(subscription.error_users)
        const confirmedUsers = Number(subscription.confirmed_users)
        const rejectedUsers = Number(subscription.rejected_users)
        const pendingUsers = Number(subscription.pending_users)
        const declined_users = Number(subscription.declined_users)

        const totalResponses = confirmedUsers + rejectedUsers + declined_users
        const responsePercentage = sentUsers > 0 ? Math.round((totalResponses / sentUsers) * 100) : 0
        const sentPercentage = totalUsers > 0 ? Math.round((sentUsers / totalUsers) * 100) : 0

        // Формируем сообщение с прогрессом
        let message = `📊 <b>Прогресс рассылки #${subscription.trip_id}</b>\n\n`

        message += `👤 <b>Отправка:</b> ${sentUsers}/${totalUsers} (${sentPercentage}%)\n`
        message += `📥 <b>Ответы:</b> ${totalResponses}/${sentUsers} (${responsePercentage}%)\n\n`

        // === НОВОЕ: Добавляем строки только для ненулевых значений ===
        const metrics = []
        if (confirmedUsers > 0) {
          metrics.push(`✅ Подтверждено: ${confirmedUsers}`)
        }
        if (rejectedUsers > 0) {
          metrics.push(`❌ Отклонено: ${rejectedUsers}`)
        }
        if (pendingUsers > 0) {
          metrics.push(`⏳ Ожидают: ${pendingUsers}`)
        }
        if (declined_users > 0) {
          metrics.push(`🚫 Отменено: ${declined_users}`)
        }
        if (errorUsers > 0) {
          metrics.push(`🆘 Ошибки: ${errorUsers}`)
        }

        // Добавляем метрики в сообщение, если есть ненулевые значения
        if (metrics.length > 0) {
          message += metrics.join('\n') + '\n\n'
        }

        // Определяем статус и завершаем ли подписку
        let shouldCompleteSubscription = false

        if (totalResponses === sentUsers && sentUsers === totalUsers && totalUsers > 0) {
          message += `🎉 <b>Рассылка завершена!</b>\n`
          message += `Все водители ответили. Подписка автоматически отменена.`
          shouldCompleteSubscription = true
        } else if (sentUsers < totalUsers) {
          message += `🚀 Рассылка в процессе отправки...`
        } else if (pendingUsers > 0) {
          message += `⏰ Ожидаем ответы от ${pendingUsers} водителей...`
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
