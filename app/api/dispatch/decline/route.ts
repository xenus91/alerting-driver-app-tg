// app/api/dispatch/decline/route.ts
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendReplyToMessage, sendMessage, editMessageReplyMarkup } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const { trip_id, phone, dispatcher_comment } = await request.json()

    if (!trip_id || !phone) {
      return NextResponse.json(
        { error: "Missing required fields (trip_id, phone)" },
        { status: 400 }
      )
    }

    console.log(`Declining trip ${trip_id} for phone ${phone}`)

    // Получаем информацию о сообщении для reply
    const messageResult = await sql`
      SELECT 
        telegram_id,
        telegram_message_id        
      FROM trip_messages 
      WHERE 
        trip_id = ${trip_id} AND 
        phone = ${phone} AND
        telegram_message_id IS NOT NULL
      LIMIT 1
    `

    // Обновляем статус рейса в базе данных
    const updateResult = await sql`
      UPDATE trip_messages 
      SET 
        response_status = 'declined',
        dispatcher_comment = ${dispatcher_comment || null},
        response_comment = 'Отменен(ы) диспетчером',
        response_at = NOW()
      WHERE 
        trip_id = ${trip_id} AND 
        phone = ${phone}
      RETURNING id
    `

    if (updateResult.length === 0) {
      return NextResponse.json(
        { error: "No matching trip found or already declined" },
        { status: 404 }
      )
    }

    // Отправляем уведомление водителю в Telegram
    if (messageResult.length > 0) {
      const { telegram_id, telegram_message_id } = messageResult[0]
      
      try {
        // Удаляем кнопки у исходного сообщения
        if (telegram_message_id && telegram_id) {
          await editMessageReplyMarkup(
            telegram_id,
            telegram_message_id,
            { inline_keyboard: [] } // Пустой массив удаляет все кнопки
          )
        }

        const messageText = `🚫 Рейс(ы) отменен(ы) диспетчером!\n\nПричина: ${dispatcher_comment || "не указана"}`

        if (telegram_message_id) {
          await sendReplyToMessage(
            telegram_id, 
            telegram_message_id, 
            messageText
          )
        } else {
          await sendMessage(telegram_id, messageText)
        }
      } catch (telegramError) {
        console.error("Error sending Telegram notification:", telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      updated_records: updateResult.length,
      trip_id,
      phone,
      telegram_notification_sent: messageResult.length > 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error in dispatch decline:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
