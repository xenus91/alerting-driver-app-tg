import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export const dynamic = "force-dynamic"

// Функция для получения текущего пользователя
async function getCurrentUser() {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get("session_token")

  if (!sessionToken) {
    return null
  }

  const result = await sql`
    SELECT u.*, s.expires_at
    FROM users u
    JOIN user_sessions s ON u.id = s.user_id
    WHERE s.session_token = ${sessionToken.value}
    AND s.expires_at > NOW()
    LIMIT 1
  `

  return result[0] || null
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    console.log(
      `Getting stats for user: ${currentUser.name} (role: ${currentUser.role}, carpark: ${currentUser.carpark})`,
    )

    let activeTripsQuery, registeredUsersQuery, sentMessagesQuery

    if (currentUser.role === "operator" && currentUser.carpark) {
      // Статистика для оператора - только его автопарк
      activeTripsQuery = sql`
        SELECT COUNT(*) as count
        FROM trips
        WHERE status = 'active' AND carpark = ${currentUser.carpark}
      `

      registeredUsersQuery = sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE role = 'driver' AND carpark = ${currentUser.carpark} AND registration_state = 'completed'
      `

      sentMessagesQuery = sql`
        SELECT COUNT(*) as count
        FROM trip_messages tm
        JOIN trips t ON tm.trip_id = t.id
        WHERE tm.status = 'sent' AND t.carpark = ${currentUser.carpark}
      `
    } else {
      // Статистика для админа - все данные
      activeTripsQuery = sql`
        SELECT COUNT(*) as count
        FROM trips
        WHERE status = 'active'
      `

      registeredUsersQuery = sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE registration_state = 'completed'
      `

      sentMessagesQuery = sql`
        SELECT COUNT(*) as count
        FROM trip_messages
        WHERE status = 'sent'
      `
    }

    const [activeTrips, registeredUsers, sentMessages] = await Promise.all([
      activeTripsQuery,
      registeredUsersQuery,
      sentMessagesQuery,
    ])

    const stats = {
      activeTrips: Number.parseInt(activeTrips[0].count),
      registeredUsers: Number.parseInt(registeredUsers[0].count),
      sentMessages: Number.parseInt(sentMessages[0].count),
    }

    console.log(`Stats for ${currentUser.role}:`, stats)

    return NextResponse.json({
      success: true,
      stats,
      currentUser: {
        role: currentUser.role,
        carpark: currentUser.carpark,
      },
    })
  } catch (error) {
    console.error("Error getting stats:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении статистики",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
