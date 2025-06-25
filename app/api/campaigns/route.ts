import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Получаем информацию о текущем пользователе из сессии
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Получаем данные текущего пользователя
    const currentUserResult = await sql`
      SELECT id, role, carpark 
      FROM users 
      WHERE telegram_id = ${Number.parseInt(sessionCookie.value)}
    `

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    const currentUser = currentUserResult[0]

    // Получаем кампании с учетом роли пользователя
    let campaignsQuery

    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только кампании для своего автопарка
      campaignsQuery = sql`
        SELECT DISTINCT c.id, c.name, c.created_at, c.message_count, c.success_count, c.error_count
        FROM campaigns c
        JOIN trip_messages tm ON c.id = tm.campaign_id
        JOIN trips t ON tm.trip_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE u.carpark = ${currentUser.carpark}
        ORDER BY c.created_at DESC
      `
    } else {
      // Администраторы видят все кампании
      campaignsQuery = sql`
        SELECT id, name, created_at, message_count, success_count, error_count
        FROM campaigns
        ORDER BY created_at DESC
      `
    }

    const campaigns = await campaignsQuery

    return NextResponse.json({
      campaigns,
      currentUser: {
        role: currentUser.role,
        carpark: currentUser.carpark,
      },
    })
  } catch (error) {
    console.error("Get campaigns error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении кампаний",
      },
      { status: 500 },
    )
  }
}
