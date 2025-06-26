import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)

    if (isNaN(tripId)) {
      return NextResponse.json({ success: false, error: "Invalid trip ID" }, { status: 400 })
    }

    // Получаем текущего пользователя из сессии
    // Пока используем заглушку - в реальности нужно получать из сессии
    const userId = 1 // TODO: получать из сессии

    // Деактивируем подписку
    const result = await sql`
      UPDATE trip_subscriptions 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE trip_id = ${tripId} AND user_id = ${userId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Successfully unsubscribed",
    })
  } catch (error) {
    console.error("Error deleting subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to delete subscription" }, { status: 500 })
  }
}
