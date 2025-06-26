import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

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
      // Получаем подписку для конкретной рассылки
      query = sql`
        SELECT * FROM trip_subscriptions 
        WHERE user_telegram_id = ${userTelegramId} AND trip_id = ${Number.parseInt(tripId)} AND is_active = true
      `
    } else {
      // Получаем все активные подписки пользователя
      query = sql`
        SELECT ts.*, t.created_at as trip_created_at
        FROM trip_subscriptions ts
        JOIN trips t ON ts.trip_id = t.id
        WHERE ts.user_telegram_id = ${userTelegramId} AND ts.is_active = true
        ORDER BY ts.created_at DESC
      `
    }

    const subscriptions = await query

    return NextResponse.json({
      success: true,
      subscriptions,
    })
  } catch (error) {
    console.error("Error getting subscriptions:", error)
    return NextResponse.json({ success: false, error: "Failed to get subscriptions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trip_id, user_telegram_id, interval_minutes } = body

    if (!trip_id || !user_telegram_id || !interval_minutes) {
      return NextResponse.json(
        { success: false, error: "trip_id, user_telegram_id, and interval_minutes are required" },
        { status: 400 },
      )
    }

    // Проверяем, что интервал корректный (кратен 15 минутам и в диапазоне 15-120)
    if (interval_minutes < 15 || interval_minutes > 120 || interval_minutes % 15 !== 0) {
      return NextResponse.json(
        { success: false, error: "interval_minutes must be between 15 and 120 and divisible by 15" },
        { status: 400 },
      )
    }

    // Проверяем, существует ли уже подписка
    const existingSubscription = await sql`
      SELECT id FROM trip_subscriptions 
      WHERE trip_id = ${trip_id} AND user_telegram_id = ${user_telegram_id} AND is_active = true
    `

    if (existingSubscription.length > 0) {
      return NextResponse.json({ success: false, error: "Subscription already exists" }, { status: 400 })
    }

    // Создаем новую подписку
    const result = await sql`
      INSERT INTO trip_subscriptions (trip_id, user_telegram_id, interval_minutes, is_active)
      VALUES (${trip_id}, ${user_telegram_id}, ${interval_minutes}, true)
      RETURNING *
    `

    console.log(`Created subscription for trip ${trip_id}, user ${user_telegram_id}, interval ${interval_minutes}`)

    return NextResponse.json({
      success: true,
      subscription: result[0],
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to create subscription" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userTelegramId = searchParams.get("user_telegram_id")
    const tripId = searchParams.get("trip_id")

    if (!userTelegramId || !tripId) {
      return NextResponse.json({ success: false, error: "user_telegram_id and trip_id are required" }, { status: 400 })
    }

    // Деактивируем подписку
    const result = await sql`
      UPDATE trip_subscriptions 
      SET is_active = false
      WHERE user_telegram_id = ${userTelegramId} AND trip_id = ${Number.parseInt(tripId)} AND is_active = true
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    }

    console.log(`Deactivated subscription for trip ${tripId}, user ${userTelegramId}`)

    return NextResponse.json({
      success: true,
      message: "Subscription deactivated",
    })
  } catch (error) {
    console.error("Error deleting subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to delete subscription" }, { status: 500 })
  }
}
