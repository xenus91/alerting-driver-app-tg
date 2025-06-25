import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

// Функция для проверки API ключа
async function validateApiKey(apiKey: string) {
  try {
    const result = await sql`
      SELECT ak.*, u.id as user_id, u.role, u.carpark
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.api_key = ${apiKey} 
        AND ak.is_active = true 
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        AND 'read_users' = ANY(ak.permissions)
    `

    if (result.length > 0) {
      // Обновляем время последнего использования
      await sql`
        UPDATE api_keys 
        SET last_used_at = CURRENT_TIMESTAMP 
        WHERE id = ${result[0].id}
      `

      return result[0]
    }

    return null
  } catch (error) {
    console.error("API key validation error:", error)
    return null
  }
}

export async function GET(request: Request) {
  try {
    let currentUser = null

    // Проверяем API ключ в заголовках
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "")

    if (apiKey) {
      // Аутентификация через API ключ
      currentUser = await validateApiKey(apiKey)
      if (!currentUser) {
        return NextResponse.json({ success: false, error: "Неверный или истекший API ключ" }, { status: 401 })
      }
    } else {
      // Аутентификация через сессию (существующая логика)
      const cookieStore = await cookies()
      const sessionToken = cookieStore.get("session_token")?.value

      if (!sessionToken) {
        return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
      }

      const sessions = await sql`
        SELECT s.*, u.id, u.telegram_id, u.name, u.full_name, u.role, u.carpark
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ${sessionToken} AND s.expires_at > NOW()
      `

      if (sessions.length === 0) {
        return NextResponse.json({ success: false, error: "Сессия истекла" }, { status: 401 })
      }

      currentUser = sessions[0]
    }

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

export const dynamic = "force-dynamic"
