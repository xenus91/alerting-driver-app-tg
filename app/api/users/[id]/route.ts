import { type NextRequest, NextResponse } from "next/server"
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
    JOIN user_sessions s ON u.telegram_id = s.telegram_id
    WHERE s.session_token = ${sessionToken.value}
    AND s.expires_at > NOW()
    LIMIT 1
  `

  return result[0] || null
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const userId = Number.parseInt(params.id)
    const body = await request.json()
    const { name, first_name, last_name, carpark, role, verified } = body

    console.log(`Updating user ${userId}:`, { name, first_name, last_name, carpark, role, verified })

    // Строим запрос в зависимости от роли пользователя
    let result

    if (currentUser.role === "admin" && verified !== undefined) {
      // Админы могут изменять поле verified
      result = await sql`
        UPDATE users 
        SET name = ${name},
            first_name = ${first_name},
            last_name = ${last_name},
            full_name = ${first_name && last_name ? `${first_name} ${last_name}` : name},
            carpark = ${carpark},
            role = ${role},
            verified = ${verified}
        WHERE id = ${userId}
        RETURNING *
      `
    } else {
      // Операторы не могут изменять поле verified
      result = await sql`
        UPDATE users 
        SET name = ${name},
            first_name = ${first_name},
            last_name = ${last_name},
            full_name = ${first_name && last_name ? `${first_name} ${last_name}` : name},
            carpark = ${carpark},
            role = ${role}
        WHERE id = ${userId}
        RETURNING *
      `
    }

    if (result.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    console.log(`User ${userId} updated successfully`)

    return NextResponse.json({
      success: true,
      user: result[0],
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      {
        error: "Ошибка при обновлении пользователя",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Только админы могут удалять пользователей
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 })
    }

    const userId = Number.parseInt(params.id)

    console.log(`Deleting user ${userId}`)

    // Сначала удаляем связанные сессии
    await sql`DELETE FROM user_sessions WHERE telegram_id = (SELECT telegram_id FROM users WHERE id = ${userId})`

    // Затем удаляем пользователя
    const result = await sql`
      DELETE FROM users 
      WHERE id = ${userId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    console.log(`User ${userId} deleted successfully`)

    return NextResponse.json({
      success: true,
      message: "Пользователь успешно удален",
    })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      {
        error: "Ошибка при удалении пользователя",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
