import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

async function sendTelegramMessage(chatId: number, text: string, messageId: number) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Подтвердить",
                callback_data: `confirm_${messageId}`,
              },
              {
                text: "❌ Отклонить",
                callback_data: `reject_${messageId}`,
              },
            ],
          ],
        },
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to send message")
    }

    return data.result
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    throw error
  }
}

function generateTripMessage(
  firstName: string,
  tripId: string,
  vehicleNumber: string,
  loadingTime: string,
  pickupPoints: any[],
  deliveryPoints: any[],
  comment?: string,
) {
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "—"
    try {
      const date = new Date(dateString)
      return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return dateString
    }
  }

  let message = `🌅 Доброго времени суток!\n\n`
  message += `👤 Уважаемый, ${firstName}\n\n`
  message += `🚛 На Вас запланирован рейс ${tripId}\n`
  message += `🚗 Транспорт: ${vehicleNumber}\n`
  message += `⏰ Плановое время погрузки: ${formatDateTime(loadingTime)}\n\n`

  if (pickupPoints.length > 0) {
    message += `📦 Погрузка:\n`
    pickupPoints.forEach((point, index) => {
      message += `${index + 1}) ${point.point_name}\n`
    })
    message += `\n`
  }

  if (deliveryPoints.length > 0) {
    message += `📤 Разгрузка:\n`
    deliveryPoints.forEach((point, index) => {
      message += `${index + 1}) ${point.point_name}\n`
      if (point.door_open_1 || point.door_open_2 || point.door_open_3) {
        const windows = [point.door_open_1, point.door_open_2, point.door_open_3].filter(Boolean).join(", ")
        message += `   🕐 Окна приемки: ${windows}\n`
      }
    })
    message += `\n`
  }

  if (comment) {
    message += `💬 Комментарий по рейсу:\n${comment}\n\n`
  }

  message += `🙏 Просьба подтвердить рейс`

  return message
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id)

  try {
    // Получаем информацию о сообщении и связанных данных
    const messageResult = await sql`
      SELECT 
        tm.*,
        u.telegram_id, 
        u.first_name, 
        u.full_name,
        t.trip_identifier,
        t.vehicle_number,
        t.planned_loading_time,
        t.driver_comment
      FROM trip_messages tm
      JOIN users u ON tm.phone = u.phone
      LEFT JOIN trips t ON tm.trip_id = t.id
      WHERE tm.id = ${messageId}
    `

    if (messageResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Message not found",
        },
        { status: 404 },
      )
    }

    const message = messageResult[0]

    if (!message.telegram_id) {
      return NextResponse.json(
        {
          success: false,
          error: "User telegram_id not found",
        },
        { status: 400 },
      )
    }

    // Получаем точки маршрута
    const pointsResult = await sql`
      SELECT tp.*, p.point_name, p.door_open_1, p.door_open_2, p.door_open_3
      FROM trip_points tp
      JOIN points p ON tp.point_id = p.id
      WHERE tp.trip_id = ${message.trip_id}
      ORDER BY tp.point_type, tp.point_num
    `

    const pickupPoints = pointsResult.filter((p: any) => p.point_type === "P")
    const deliveryPoints = pointsResult.filter((p: any) => p.point_type === "D")

    // Генерируем сообщение в правильном формате
    const formattedMessage = generateTripMessage(
      message.first_name || "Водитель",
      message.trip_identifier || "Неизвестный",
      message.vehicle_number || "Не указан",
      message.planned_loading_time || "",
      pickupPoints,
      deliveryPoints,
      message.driver_comment,
    )

    // Отправляем сообщение в Telegram
    await sendTelegramMessage(message.telegram_id, formattedMessage, messageId)

    // Обновляем статус сообщения
    await sql`
      UPDATE trip_messages 
      SET status = 'sent', 
          sent_at = ${new Date().toISOString()},
          error_message = NULL,
          message = ${formattedMessage}
      WHERE id = ${messageId}
    `

    console.log(`Message ${messageId} resent to Telegram successfully`)

    return NextResponse.json({
      success: true,
      message: "Message resent to Telegram successfully",
      messageId: messageId,
      formattedMessage: formattedMessage,
    })
  } catch (error) {
    console.error("Error resending message to Telegram:", error)

    // Обновляем статус сообщения как ошибка
    try {
      await sql`
        UPDATE trip_messages 
        SET status = 'error', 
            error_message = ${error instanceof Error ? error.message : "Unknown error"}
        WHERE id = ${messageId}
      `
    } catch (updateError) {
      console.error("Error updating message status:", updateError)
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend message to Telegram",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
