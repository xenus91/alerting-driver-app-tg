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
      `Getting users for user: ${currentUser.name} (role: ${currentUser.role}, carpark: ${currentUser.carpark})`,
    )

    let users
    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только водителей из своего автопарка
      users = await sql`
        SELECT id, telegram_id, phone, name, first_name, last_name, full_name, carpark, created_at, registration_state, verified, role
        FROM users
        WHERE role = 'driver' AND carpark = ${currentUser.carpark}
        ORDER BY created_at DESC
      `
      console.log(`Operator ${currentUser.name} sees ${users.length} drivers from carpark ${currentUser.carpark}`)
    } else {
      // Админы и другие роли видят всех пользователей
      users = await sql`
        SELECT id, telegram_id, phone, name, first_name, last_name, full_name, carpark, created_at, registration_state, verified, role
        FROM users
        ORDER BY created_at DESC
      `
      console.log(`Admin/other role sees ${users.length} total users`)
    }

    return NextResponse.json({
      success: true,
      users: users, // Исправлено: возвращаем users, а не data
      currentUser: {
        role: currentUser.role,
        carpark: currentUser.carpark,
      },
    })
  } catch (error) {
    console.error("Error getting users:", error)
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
