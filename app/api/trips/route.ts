import { NextResponse } from "next/server"
import { getTrips, updateTripStatus } from "@/lib/database"

export async function GET() {
  try {
    const trips = await getTrips()

    // Проверяем и обновляем статусы завершенных рассылок
    for (const trip of trips) {
      const totalResponses = Number(trip.confirmed_responses) + Number(trip.rejected_responses)
      const sentMessages = Number(trip.sent_messages)

      // Если все отправленные сообщения получили ответы и статус не "completed"
      if (sentMessages > 0 && totalResponses === sentMessages && trip.status !== "completed") {
        console.log(`Updating trip ${trip.id} status to completed`)
        await updateTripStatus(trip.id, "completed")
        trip.status = "completed" // Обновляем в текущем результате
      }
    }

    return NextResponse.json({ success: true, trips })
  } catch (error) {
    console.error("Get trips error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении рассылок",
      },
      { status: 500 },
    )
  }
}
