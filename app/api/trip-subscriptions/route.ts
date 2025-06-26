import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// GET - получить подписки пользователя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userTelegramId = searchParams.get("user_telegram_id")
    const tripId = searchParams.get("trip_id")

    if (!userTelegramId) {
      return NextResponse.json({ success: false, error: "user_telegram_id is required" }, { status: 400 })
    }

    let query
    if (tripId) {
      // Проверить подписку на конкретную рассылку
      query = sql`
        SELECT * FROM trip_subscriptions 
        WHERE user_telegram_id = ${userTelegramId} AND trip_id = ${tripId} AND is_active = true
      `
    } else {
      // Получить все активные подписки пользователя
      query = sql`
        SELECT ts.*, t.created_at as trip_created_at
        FROM trip_subscriptions ts
        JOIN trips t ON ts.trip_id = t.id
        WHERE ts.user_telegram_id = ${userTelegramId} AND ts.is_active = true
        ORDER BY ts.created_at DESC
      `
    }

    const result = await query
    return NextResponse.json({ success: true, subscriptions: result })
  } catch (error) {
    console.error("Error getting subscriptions:", error)
    return NextResponse.json({ success: false, error: "Failed to get subscriptions" }, { status: 500 })
  }
}

// POST - создать подписку
export async function POST(request: NextRequest) {
  try {
    const { trip_id, user_telegram_id, interval_minutes = 30 } = await request.json()

    if (!trip_id || !user_telegram_id) {
      return NextResponse.json({ success: false, error: "trip_id and user_telegram_id are required" }, { status: 400 })
    }

    // Проверяем что интервал кратен 15 минутам
    if (interval_minutes % 15 !== 0 || interval_minutes < 15) {
      return NextResponse.json(
        { success: false, error: "interval_minutes must be multiple of 15 and at least 15" },
        { status: 400 },
      )
    }

    // Проверяем что рассылка существует
    const tripCheck = await sql`
      SELECT id, status FROM trips WHERE id = ${trip_id}
    `

    if (tripCheck.length === 0) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Проверяем что рассылка еще активна
    if (tripCheck[0].status === "completed") {
      return NextResponse.json({ success: false, error: "Cannot subscribe to completed trip" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO trip_subscriptions (trip_id, user_telegram_id, interval_minutes)
      VALUES (${trip_id}, ${user_telegram_id}, ${interval_minutes})
      ON CONFLICT (trip_id, user_telegram_id) 
      DO UPDATE SET 
        interval_minutes = EXCLUDED.interval_minutes,
        is_active = true,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    console.log(`Created subscription for user ${user_telegram_id} to trip ${trip_id}`)
    return NextResponse.json({ success: true, subscription: result[0] })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to create subscription" }, { status: 500 })
  }
}

// DELETE - удалить подписку
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("trip_id")
    const userTelegramId = searchParams.get("user_telegram_id")

    if (!tripId || !userTelegramId) {
      return NextResponse.json({ success: false, error: "trip_id and user_telegram_id are required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE trip_subscriptions 
      SET is_active = false
      WHERE trip_id = ${tripId} AND user_telegram_id = ${userTelegramId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    }

    console.log(`Deactivated subscription for user ${userTelegramId} from trip ${tripId}`)
    return NextResponse.json({ success: true, message: "Subscription deactivated" })
  } catch (error) {
    console.error("Error deleting subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to delete subscription" }, { status: 500 })
  }
}
