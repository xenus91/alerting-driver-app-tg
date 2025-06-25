import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export const dynamic = "force-dynamic"

async function getCurrentUser() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get("session_token")

    if (!sessionToken) {
      return null
    }

    const result = await sql`
      SELECT u.*, us.expires_at
      FROM users u
      JOIN user_sessions us ON u.telegram_id = us.telegram_id
      WHERE us.session_token = ${sessionToken.value}
        AND us.expires_at > NOW()
      LIMIT 1
    `

    return result[0] || null
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
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
    console.log(`Current user role: ${currentUser.role}`)

    // Проверяем права на изменение verified
    if (verified !== undefined && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Недостаточно прав для изменения статуса верификации" }, { status: 403 })
    }

    let updateQuery
    if (verified !== undefined && currentUser.role === "admin") {
      // Администратор может изменять verified
      updateQuery = sql`
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
      // Обычное обновление без verified
      updateQuery = sql`
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

    const result = await updateQuery

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

    // Только администраторы могут удалять пользователей
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Недостаточно прав для удаления пользователей" }, { status: 403 })
    }

    const userId = Number.parseInt(params.id)

    console.log(`Admin ${currentUser.telegram_id} deleting user ${userId}`)

    // Проверяем, что пользователь существует
    const userCheck = await sql`
      SELECT id, name, telegram_id FROM users WHERE id = ${userId}
    `

    if (userCheck.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    const userToDelete = userCheck[0]

    // Удаляем связанные данные
    await sql`DELETE FROM user_sessions WHERE telegram_id = ${userToDelete.telegram_id}`
    await sql`DELETE FROM user_pending_actions WHERE user_id = ${userId}`

    // Удаляем пользователя
    await sql`DELETE FROM users WHERE id = ${userId}`

    console.log(`User ${userId} (${userToDelete.name}) deleted successfully by admin ${currentUser.telegram_id}`)

    return NextResponse.json({
      success: true,
      message: `Пользователь ${userToDelete.name} удален`,
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
