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

    // Определяем фильтр в зависимости от роли пользователя
    let usersQuery

    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только водителей из своего автопарка
      usersQuery = sql`
        SELECT id, telegram_id, phone, name, created_at, first_name, last_name, full_name, role, verified, carpark, registration_state
        FROM users
        WHERE role = 'driver' AND carpark = ${currentUser.carpark}
        ORDER BY created_at DESC
      `
    } else {
      // Администраторы и другие роли видят всех пользователей
      usersQuery = sql`
        SELECT id, telegram_id, phone, name, created_at, first_name, last_name, full_name, role, verified, carpark, registration_state
        FROM users
        ORDER BY created_at DESC
      `
    }

    const users = await usersQuery

    return NextResponse.json({
      success: true,
      users: users,
      currentUser: {
        role: currentUser.role,
        carpark: currentUser.carpark,
      },
    })
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении пользователей",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
