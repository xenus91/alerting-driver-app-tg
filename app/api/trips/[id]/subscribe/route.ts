import { type NextRequest, NextResponse } from "next/server"
import { createTripSubscription } from "@/lib/database"

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
        {
          success: false,
          error: "Invalid interval. Must be between 5 and 1440 minutes",
        },
        { status: 400 },
      )
    }

    // Получаем текущего пользователя из сессии
    // В реальном приложении здесь должна быть проверка авторизации
    const userId = 1 // Временно используем фиксированный ID

    const subscription = await createTripSubscription(tripId, userId, interval_minutes)

    return NextResponse.json({
      success: true,
      subscription,
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
