import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { sendReplyToMessage, sendMessage } from "@/lib/telegram"

const sql = neon(process.env.DATABASE_URL!)

// app/api/dispatch/confirm/route.ts
export async function POST(request: Request) {
  try {
    const { trip_id, phone, action, dispatcher_comment } = await request.json()

    if (!trip_id || !phone || !action) {
      return NextResponse.json(
        { error: "Missing required fields (trip_id, phone, action)" },
        { status: 400 }
      )
    }

    console.log(`Dispatching ${action} for trip ${trip_id}, phone ${phone}`)

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
        response_status = ${action === "confirm" ? "confirmed" : "rejected"},
        dispatcher_comment = ${dispatcher_comment || null},
        response_comment = ${dispatcher_comment || null},
        response_at = NOW()
      WHERE 
        trip_id = ${trip_id} AND 
        phone = ${phone}
      RETURNING id
    `

    if (updateResult.length === 0) {
      return NextResponse.json(
        { error: "No matching trip found or already processed" },
        { status: 404 }
      )
    }

    // Отправляем уведомление водителю в Telegram, если есть данные
    if (messageResult.length > 0) {
      const { telegram_id, telegram_message_id } = messageResult[0]
      
      try {
        const messageText = action === "confirm" 
          ? `✅ Рейс(ы) подтвержден(ы) диспетчером!\n\nКомментарий диспетчера: ${dispatcher_comment || "без комментария"}`
          : `❌ Рейс(ы) отклонен(ы) диспетчером!\n\nПричина: ${dispatcher_comment || "не указана"}`

        // Пытаемся отправить reply
        if (telegram_message_id) {
          await sendReplyToMessage(
            telegram_id, 
            telegram_message_id, 
            messageText
          )
        } else {
          // Или обычное сообщение
          await sendMessage(
            telegram_id,
            messageText
          )
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
      action,
      telegram_notification_sent: messageResult.length > 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error in dispatch confirmation:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const trip_id = searchParams.get('trip_id')
    const phone = searchParams.get('phone')

    if (!trip_id || !phone) {
      return NextResponse.json(
        { error: "Missing trip_id or phone parameters" },
        { status: 400 }
      )
    }

    const result = await sql`
      SELECT 
        trip_id,
        phone,
        response_status,
        response_at,
        response_comment
      FROM trip_messages
      WHERE 
        trip_id = ${trip_id} AND 
        phone = ${phone}
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      trip: result[0],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error fetching trip status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
