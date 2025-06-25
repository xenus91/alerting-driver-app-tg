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
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    console.log(
      `Getting trips for user: ${currentUser.name} (role: ${currentUser.role}, carpark: ${currentUser.carpark})`,
    )

    let trips
    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только поездки своего автопарка
      trips = await sql`
        SELECT t.*, 
               COUNT(tm.id) as total_messages,
               COUNT(CASE WHEN tm.status = 'sent' THEN 1 END) as sent_messages,
               COUNT(CASE WHEN tm.status = 'error' THEN 1 END) as error_messages,
               COUNT(CASE WHEN tm.response_status = 'confirmed' THEN 1 END) as confirmed_responses,
               COUNT(CASE WHEN tm.response_status = 'rejected' THEN 1 END) as rejected_responses,
               COUNT(CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN 1 END) as pending_responses,
               MIN(tm.sent_at) as first_sent_at,
               MAX(tm.sent_at) as last_sent_at
        FROM trips t
        LEFT JOIN trip_messages tm ON t.id = tm.trip_id
        WHERE t.carpark = ${currentUser.carpark}
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `
      console.log(`Operator ${currentUser.name} sees ${trips.length} trips from carpark ${currentUser.carpark}`)
    } else {
      // Админы видят все поездки
      trips = await sql`
        SELECT t.*, 
               COUNT(tm.id) as total_messages,
               COUNT(CASE WHEN tm.status = 'sent' THEN 1 END) as sent_messages,
               COUNT(CASE WHEN tm.status = 'error' THEN 1 END) as error_messages,
               COUNT(CASE WHEN tm.response_status = 'confirmed' THEN 1 END) as confirmed_responses,
               COUNT(CASE WHEN tm.response_status = 'rejected' THEN 1 END) as rejected_responses,
               COUNT(CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN 1 END) as pending_responses,
               MIN(tm.sent_at) as first_sent_at,
               MAX(tm.sent_at) as last_sent_at
        FROM trips t
        LEFT JOIN trip_messages tm ON t.id = tm.trip_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `
      console.log(`Admin sees ${trips.length} total trips`)
    }

    return NextResponse.json({
      success: true,
      data: trips,
      currentUser: {
        role: currentUser.role,
        carpark: currentUser.carpark,
      },
    })
  } catch (error) {
    console.error("Error getting trips:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении поездок",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const { tripId } = await request.json()

    console.log(`Deleting trip ${tripId}`)

    // Удаляем связанные записи в правильном порядке
    await sql`DELETE FROM trip_messages WHERE trip_id = ${tripId}`
    await sql`DELETE FROM trip_points WHERE trip_id = ${tripId}`
    await sql`DELETE FROM trips WHERE id = ${tripId}`

    console.log(`Trip ${tripId} and related records deleted`)

    return NextResponse.json({
      success: true,
      message: "Поездка успешно удалена",
    })
  } catch (error) {
    console.error("Error deleting trip:", error)
    return NextResponse.json(
      {
        error: "Ошибка при удалении поездки",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
