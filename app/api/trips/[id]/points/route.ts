import { type NextRequest, NextResponse } from "next/server"
import { getTripPoints } from "@/lib/database"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)

  try {
    console.log(`Fetching points for trip ${tripId}`)

    // Получаем точки маршрута для рейса
    const points = await getTripPoints(tripId)

    console.log(`Found ${points.length} points for trip ${tripId}:`, points)

    return NextResponse.json({
      success: true,
      points: points,
    })
  } catch (error) {
    console.error("Error fetching trip points:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch trip points",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
