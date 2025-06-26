import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

interface TripStats {
  trip_id: number
  total_messages: number
  sent_messages: number
  confirmed_responses: number
  rejected_responses: number
  pending_responses: number
  response_percentage: number
}

async function getTripStats(tripId: number): Promise<TripStats | null> {
  try {
    const result = await sql`
      SELECT 
        t.id as trip_id,
        COUNT(tm.id) as total_messages,
        COUNT(CASE WHEN tm.status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN tm.response_status = 'confirmed' THEN 1 END) as confirmed_responses,
        COUNT(CASE WHEN tm.response_status = 'rejected' THEN 1 END) as rejected_responses,
        COUNT(CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN 1 END) as pending_responses
      FROM trips t
      LEFT JOIN trip_messages tm ON t.id = tm.trip_id
      WHERE t.id = ${tripId}
      GROUP BY t.id
    `

    if (result.length === 0) return null

    const stats = result[0]
    const sentNum = Number(stats.sent_messages)
    const confirmedNum = Number(stats.confirmed_responses)
    const rejectedNum = Number(stats.rejected_responses)

    const responsePercentage =
      sentNum > 0 ? Math.min(Math.round(((confirmedNum + rejectedNum) / sentNum) * 100), 100) : 0

    return {
      trip_id: tripId,
      total_messages: Number(stats.total_messages),
      sent_messages: sentNum,
      confirmed_responses: confirmedNum,
      rejected_responses: rejectedNum,
      pending_responses: Number(stats.pending_responses),
      response_percentage: responsePercentage,
    }
  } catch (error) {
    console.error("Error getting trip stats:", error)
    return null
  }
}

async function sendTelegramNotification(telegramId: number, message: string) {
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
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    return true
  } catch (error) {
    console.error("Error sending telegram notification:", error)
    return false
  }
}

function formatNotificationMessage(stats: TripStats): string {
  const { trip_id, sent_messages, confirmed_responses, rejected_responses, pending_responses, response_percentage } =
    stats

  let statusEmoji = "⏳"
  let statusText = "в процессе"

  if (pending_responses === 0 && sent_messages > 0) {
    statusEmoji = "✅"
    statusText = "завершена"
  } else if (response_percentage >= 80) {
    statusEmoji = "🔥"
    statusText = "почти готова"
  } else if (response_percentage >= 50) {
    statusEmoji = "📈"
    statusText = "активно отвечают"
  }

  const currentTime = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return `
${statusEmoji} <b>Рассылка #${trip_id}</b> - ${statusText}

📊 <b>Статистика ответов:</b>
• Отправлено: ${sent_messages} сообщений
• Получено ответов: <b>${response_percentage}%</b> (${confirmed_responses + rejected_responses}/${sent_messages})

✅ Подтвердили: <b>${confirmed_responses}</b>
❌ Отклонили: <b>${rejected_responses}</b>
⏳ Ожидают: <b>${pending_responses}</b>

🕐 Время: ${currentTime}

${
  pending_responses === 0 && sent_messages > 0
    ? "🎉 Все ответы получены! Подписка автоматически отключена."
    : "📱 Следующее уведомление при изменении статуса или по интервалу."
}
  `.trim()
}

// Основная функция для проверки и отправки уведомлений
export async function checkAndSendNotifications(tripId: number, triggeredByResponse = false) {
  try {
    console.log(`🔔 Checking notifications for trip ${tripId}, triggered by response: ${triggeredByResponse}`)

    // Получаем статистику рассылки
    const stats = await getTripStats(tripId)
    if (!stats) {
      console.log(`Trip ${tripId} not found`)
      return { success: false, error: "Trip not found" }
    }

    // Получаем активные подписки на эту рассылку
    const subscriptions = await sql`
      SELECT 
        ts.*,
        u.telegram_id,
        u.first_name,
        u.full_name
      FROM trip_subscriptions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.trip_id = ${tripId}
        AND ts.is_active = true
        AND u.telegram_id IS NOT NULL
    `

    console.log(`Found ${subscriptions.length} active subscriptions for trip ${tripId}`)

    if (subscriptions.length === 0) {
      return { success: true, message: "No active subscriptions" }
    }

    let sentCount = 0
    let errorCount = 0

    for (const subscription of subscriptions) {
      try {
        // Проверяем нужно ли отправлять уведомление
        const shouldSend = await shouldSendNotification(subscription, triggeredByResponse)

        if (!shouldSend) {
          console.log(`Skipping notification for user ${subscription.telegram_id} - not time yet`)
          continue
        }

        // Проверяем, завершена ли рассылка
        const isCompleted = stats.pending_responses === 0 && stats.sent_messages > 0

        // Формируем сообщение
        const message = formatNotificationMessage(stats)

        // Отправляем уведомление
        const sent = await sendTelegramNotification(subscription.telegram_id, message)

        if (sent) {
          // Обновляем время последней отправки
          await sql`
            UPDATE trip_subscriptions 
            SET last_sent_at = CURRENT_TIMESTAMP,
                is_active = ${!isCompleted},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${subscription.id}
          `

          sentCount++
          console.log(`✅ Sent notification for trip ${tripId} to user ${subscription.telegram_id}`)

          if (isCompleted) {
            console.log(`🎯 Trip ${tripId} completed, subscription deactivated for user ${subscription.telegram_id}`)
          }
        } else {
          errorCount++
          console.log(`❌ Failed to send notification for trip ${tripId} to user ${subscription.telegram_id}`)
        }
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
        errorCount++
      }
    }

    return {
      success: true,
      sent: sentCount,
      errors: errorCount,
      total: subscriptions.length,
    }
  } catch (error) {
    console.error("Error checking and sending notifications:", error)
    return { success: false, error: "Failed to send notifications" }
  }
}

// Проверяем нужно ли отправлять уведомление
async function shouldSendNotification(subscription: any, triggeredByResponse: boolean): Promise<boolean> {
  // Если это первое уведомление - отправляем
  if (!subscription.last_sent_at) {
    return true
  }

  // Если уведомление вызвано ответом водителя - отправляем только если прошло минимум 5 минут
  if (triggeredByResponse) {
    const lastSent = new Date(subscription.last_sent_at)
    const now = new Date()
    const minutesSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60)
    return minutesSinceLastSent >= 5 // Минимум 5 минут между уведомлениями
  }

  // Проверяем интервал
  const lastSent = new Date(subscription.last_sent_at)
  const now = new Date()
  const minutesSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60)

  return minutesSinceLastSent >= subscription.interval_minutes
}

// Функция для принудительной отправки уведомлений (для кнопки "Отправить сейчас")
export async function forceSendNotifications(tripId: number) {
  try {
    console.log(`🚀 Force sending notifications for trip ${tripId}`)

    const stats = await getTripStats(tripId)
    if (!stats) {
      return { success: false, error: "Trip not found" }
    }

    const subscriptions = await sql`
      SELECT 
        ts.*,
        u.telegram_id,
        u.first_name,
        u.full_name
      FROM trip_subscriptions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.trip_id = ${tripId}
        AND ts.is_active = true
        AND u.telegram_id IS NOT NULL
    `

    let sentCount = 0
    let errorCount = 0

    for (const subscription of subscriptions) {
      try {
        const isCompleted = stats.pending_responses === 0 && stats.sent_messages > 0
        const message = formatNotificationMessage(stats)
        const sent = await sendTelegramNotification(subscription.telegram_id, message)

        if (sent) {
          await sql`
            UPDATE trip_subscriptions 
            SET last_sent_at = CURRENT_TIMESTAMP,
                is_active = ${!isCompleted},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${subscription.id}
          `
          sentCount++
        } else {
          errorCount++
        }
      } catch (error) {
        console.error(`Error in force send for subscription ${subscription.id}:`, error)
        errorCount++
      }
    }

    return {
      success: true,
      sent: sentCount,
      errors: errorCount,
      total: subscriptions.length,
    }
  } catch (error) {
    console.error("Error force sending notifications:", error)
    return { success: false, error: "Failed to force send notifications" }
  }
}
