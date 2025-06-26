import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)

    if (isNaN(tripId)) {
      return NextResponse.json({ success: false, error: "Invalid trip ID" }, { status: 400 })
    }

    const body = await request.json()
    const { interval_minutes } = body

    if (!interval_minutes || interval_minutes < 5 || interval_minutes > 1440) {
      return NextResponse.json(
        { success: false, error: "Invalid interval. Must be between 5 and 1440 minutes" },
        { status: 400 },
      )
    }

    // Получаем текущего пользователя из сессии
    // Пока используем заглушку - в реальности нужно получать из сессии
    const userId = 1 // TODO: получать из сессии

    // Проверяем существует ли рассылка
    const tripCheck = await sql`
      SELECT id FROM trips WHERE id = ${tripId}
    `

    if (tripCheck.length === 0) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Создаем или обновляем подписку
    const result = await sql`
      INSERT INTO trip_subscriptions (trip_id, user_id, interval_minutes, is_active, created_at, last_sent_at)
      VALUES (${tripId}, ${userId}, ${interval_minutes}, true, CURRENT_TIMESTAMP, NULL)
      ON CONFLICT (trip_id, user_id) DO UPDATE SET
        interval_minutes = EXCLUDED.interval_minutes,
        is_active = true,
        created_at = CURRENT_TIMESTAMP,
        last_sent_at = NULL
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      subscription: result[0],
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to create subscription" }, { status: 500 })
  }
}
