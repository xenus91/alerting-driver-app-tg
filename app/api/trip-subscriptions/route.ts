import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userTelegramId = searchParams.get("user_telegram_id")
    const tripId = searchParams.get("trip_id")

    if (!userTelegramId) {
      return NextResponse.json({ error: "user_telegram_id is required" }, { status: 400 })
    }

    let query = `
      SELECT ts.*, t.title as trip_title
      FROM trip_subscriptions ts
      JOIN trips t ON ts.trip_id = t.id
      WHERE ts.user_telegram_id = $1 AND ts.is_active = true
    `
    const params = [Number.parseInt(userTelegramId)]

    if (tripId) {
      query += " AND ts.trip_id = $2"
      params.push(Number.parseInt(tripId))
    }

    query += " ORDER BY ts.created_at DESC"

    const subscriptions = await sql(query, params)

    return NextResponse.json({
      success: true,
      subscriptions,
    })
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trip_id, user_telegram_id, interval_minutes } = body

    if (!trip_id || !user_telegram_id || !interval_minutes) {
      return NextResponse.json(
        { error: "trip_id, user_telegram_id, and interval_minutes are required" },
        { status: 400 },
      )
    }

    // Проверяем, что интервал кратен 15 минутам и в допустимом диапазоне
    if (interval_minutes < 15 || interval_minutes > 120 || interval_minutes % 15 !== 0) {
      return NextResponse.json(
        { error: "interval_minutes must be between 15 and 120 and divisible by 15" },
        { status: 400 },
      )
    }

    // Проверяем, что подписка еще не существует
    const existingSubscription = await sql(
      "SELECT id FROM trip_subscriptions WHERE trip_id = $1 AND user_telegram_id = $2 AND is_active = true",
      [trip_id, user_telegram_id],
    )

    if (existingSubscription.length > 0) {
      return NextResponse.json({ error: "Subscription already exists for this trip" }, { status: 409 })
    }

    // Создаем новую подписку
    const result = await sql(
      `INSERT INTO trip_subscriptions (trip_id, user_telegram_id, interval_minutes, is_active, created_at, last_notification_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       RETURNING *`,
      [trip_id, user_telegram_id, interval_minutes],
    )

    return NextResponse.json({
      success: true,
      subscription: result[0],
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("trip_id")
    const userTelegramId = searchParams.get("user_telegram_id")

    if (!tripId || !userTelegramId) {
      return NextResponse.json({ error: "trip_id and user_telegram_id are required" }, { status: 400 })
    }

    // Деактивируем подписку
    const result = await sql(
      "UPDATE trip_subscriptions SET is_active = false WHERE trip_id = $1 AND user_telegram_id = $2 AND is_active = true RETURNING *",
      [Number.parseInt(tripId), Number.parseInt(userTelegramId)],
    )

    if (result.length === 0) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Subscription deactivated successfully",
    })
  } catch (error) {
    console.error("Error deleting subscription:", error)
    return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 })
  }
}
