import { type NextRequest, NextResponse } from "next/server"
import { getTripSubscription } from "@/lib/database"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)

    if (isNaN(tripId)) {
      return NextResponse.json({ success: false, error: "Invalid trip ID" }, { status: 400 })
    }

    // Получаем текущего пользователя из сессии
    // В реальном приложении здесь должна быть проверка авторизации
    const userId = 1 // Временно используем фиксированный ID

    const subscription = await getTripSubscription(tripId, userId)

    return NextResponse.json({
      success: true,
      subscription: subscription || null,
    })
  } catch (error) {
    console.error("Error getting subscription:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
