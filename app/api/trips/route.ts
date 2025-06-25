import { NextResponse } from "next/server"
import { getTrips, updateTripStatus } from "@/lib/database"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Получаем session_token из cookies
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("session_token")?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    // Получаем данные текущего пользователя через сессию
    const sessions = await sql`
      SELECT s.*, u.id, u.telegram_id, u.name, u.full_name, u.role, u.carpark
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ${sessionToken} AND s.expires_at > NOW()
    `

    if (sessions.length === 0) {
      return NextResponse.json({ success: false, error: "Сессия истекла" }, { status: 401 })
    }

    const currentUser = sessions[0]

    // Получаем поездки с учетом роли пользователя
    let trips

    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только поездки из своего автопарка
      trips = await getTrips(currentUser.carpark)
    } else {
      // Администраторы видят все поездки
      trips = await getTrips()
    }

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

    return NextResponse.json({
      success: true,
      trips: trips,
      currentUser: {
        role: currentUser.role,
        carpark: currentUser.carpark,
      },
    })
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
