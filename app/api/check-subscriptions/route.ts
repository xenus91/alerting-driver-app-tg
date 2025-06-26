import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendMessage } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    console.log("=== CHECKING SUBSCRIPTIONS ===")

    // Получаем все активные подписки, которые нужно проверить
    const subscriptions = await sql`
      SELECT 
        ts.*,
        t.status as trip_status,
        COUNT(tm.id) as total_messages,
        COUNT(CASE WHEN tm.status = 'sent' THEN 1 END) as sent_messages,
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
          OR ts.last_notification_at < NOW() - INTERVAL '1 minute' * ts.interval_minutes
        )
      GROUP BY ts.id, t.id, t.status
    `

    console.log(`Found ${subscriptions.length} subscriptions to check`)

    let notificationsSent = 0

    for (const subscription of subscriptions) {
      try {
        const totalMessages = Number(subscription.total_messages)
        const sentMessages = Number(subscription.sent_messages)
        const confirmedResponses = Number(subscription.confirmed_responses)
        const rejectedResponses = Number(subscription.rejected_responses)
        const pendingResponses = Number(subscription.pending_responses)

        const totalResponses = confirmedResponses + rejectedResponses
        const responsePercentage = sentMessages > 0 ? Math.round((totalResponses / sentMessages) * 100) : 0

        // Формируем сообщение с прогрессом
        let message = `📊 <b>Прогресс рассылки #${subscription.trip_id}</b>\n\n`

        message += `📤 <b>Отправка:</b> ${sentMessages}/${totalMessages} (${sentMessages > 0 ? Math.round((sentMessages / totalMessages) * 100) : 0}%)\n`
        message += `📥 <b>Ответы:</b> ${totalResponses}/${sentMessages} (${responsePercentage}%)\n\n`

        message += `✅ Подтверждено: ${confirmedResponses}\n`
        message += `❌ Отклонено: ${rejectedResponses}\n`
        message += `⏳ Ожидают: ${pendingResponses}\n\n`

        // Определяем статус
        if (totalResponses === sentMessages && sentMessages === totalMessages) {
          message += `🎉 <b>Рассылка завершена!</b>`

          // Деактивируем подписку для завершенных рассылок
          await sql`
            UPDATE trip_subscriptions 
            SET is_active = false
            WHERE id = ${subscription.id}
          `

          await sql`
            UPDATE trips 
            SET status = 'completed'
            WHERE id = ${subscription.trip_id}
          `
        } else if (sentMessages < totalMessages) {
          message += `🚀 Рассылка в процессе отправки...`
        } else {
          message += `⏰ Ожидаем ответы от водителей...`
        }

        // Отправляем уведомление
        await sendMessage(subscription.user_telegram_id, message)

        // Обновляем время последнего уведомления
        await sql`
          UPDATE trip_subscriptions 
          SET last_notification_at = CURRENT_TIMESTAMP
          WHERE id = ${subscription.id}
        `

        notificationsSent++
        console.log(`Sent notification for subscription ${subscription.id} to user ${subscription.user_telegram_id}`)
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
      }
    }

    console.log(`=== SUBSCRIPTIONS CHECK COMPLETED: ${notificationsSent} notifications sent ===`)

    return NextResponse.json({
      success: true,
      checked: subscriptions.length,
      sent: notificationsSent,
    })
  } catch (error) {
    console.error("Error checking subscriptions:", error)
    return NextResponse.json({ success: false, error: "Failed to check subscriptions" }, { status: 500 })
  }
}
