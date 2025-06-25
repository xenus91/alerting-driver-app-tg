import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Проверяем авторизацию
    const sessionCookie = cookies().get("session_token")
    if (!sessionCookie) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Получаем текущего пользователя
    const currentUserResult = await sql`
      SELECT u.*, s.expires_at
      FROM users u
      JOIN user_sessions s ON u.telegram_id = s.telegram_id
      WHERE s.session_token = ${sessionCookie.value}
      AND s.expires_at > NOW()
    `

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: "Сессия недействительна" }, { status: 401 })
    }

    const currentUser = currentUserResult[0]

    // Проверяем, что текущий пользователь - администратор
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 })
    }

    const userId = Number.parseInt(params.id)

    // Удаляем пользователя
    const result = await sql`
      DELETE FROM users 
      WHERE id = ${userId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    console.log(`User ${userId} deleted by admin ${currentUser.telegram_id}`)

    return NextResponse.json({
      success: true,
      message: "Пользователь удален",
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
