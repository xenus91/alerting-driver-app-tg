import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Получаем информацию о текущем пользователе из сессии
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    // Получаем данные текущего пользователя
    const currentUserResult = await sql`
      SELECT id, role, carpark 
      FROM users 
      WHERE telegram_id = ${Number.parseInt(sessionCookie.value)}
    `

    if (currentUserResult.length === 0) {
      return NextResponse.json({ success: false, error: "Пользователь не найден" }, { status: 404 })
    }

    const currentUser = currentUserResult[0]

    // Получаем поездки с учетом роли пользователя
    let tripsQuery

    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только поездки пользователей из своего автопарка
      tripsQuery = sql`
        SELECT 
          t.id,
          t.trip_identifier,
          t.trip_date,
          t.trip_time,
          t.status,
          t.created_at,
          t.updated_at,
          u.name as user_name,
          u.phone as user_phone,
          u.telegram_id as user_telegram_id,
          u.carpark as user_carpark,
          COUNT(tp.id) as points_count,
          COUNT(tm.id) as messages_count
        FROM trips t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN trip_points tp ON t.id = tp.trip_id
        LEFT JOIN trip_messages tm ON t.id = tm.trip_id
        WHERE u.carpark = ${currentUser.carpark}
        GROUP BY t.id, u.name, u.phone, u.telegram_id, u.carpark
        ORDER BY t.created_at DESC
      `
    } else {
      // Администраторы видят все поездки
      tripsQuery = sql`
        SELECT 
          t.id,
          t.trip_identifier,
          t.trip_date,
          t.trip_time,
          t.status,
          t.created_at,
          t.updated_at,
          u.name as user_name,
          u.phone as user_phone,
          u.telegram_id as user_telegram_id,
          u.carpark as user_carpark,
          COUNT(tp.id) as points_count,
          COUNT(tm.id) as messages_count
        FROM trips t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN trip_points tp ON t.id = tp.trip_id
        LEFT JOIN trip_messages tm ON t.id = tm.trip_id
        GROUP BY t.id, u.name, u.phone, u.telegram_id, u.carpark
        ORDER BY t.created_at DESC
      `
    }

    const trips = await tripsQuery

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
        error: "Ошибка при получении поездок",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export const dynamic = "force-dynamic"
