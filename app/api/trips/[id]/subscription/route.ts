import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)

    if (isNaN(tripId)) {
      return NextResponse.json({ success: false, error: "Invalid trip ID" }, { status: 400 })
    }

    // Получаем текущего пользователя из сессии
    // Пока используем заглушку - в реальности нужно получать из сессии
    const userId = 1 // TODO: получать из сессии

    const result = await sql`
      SELECT * FROM trip_subscriptions 
      WHERE trip_id = ${tripId} AND user_id = ${userId} AND is_active = true
    `

    return NextResponse.json({
      success: true,
      subscription: result[0] || null,
    })
  } catch (error) {
    console.error("Error getting subscription:", error)
    return NextResponse.json({ success: false, error: "Failed to get subscription" }, { status: 500 })
  }
}
