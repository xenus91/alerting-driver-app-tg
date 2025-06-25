import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

// DELETE - удалить API ключ
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const keyId = Number.parseInt(params.id)

    if (isNaN(keyId)) {
      return NextResponse.json({ success: false, error: "Неверный ID ключа" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("session_token")?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    // Получаем текущего пользователя
    const sessions = await sql`
      SELECT s.*, u.id, u.role, u.full_name
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ${sessionToken} AND s.expires_at > NOW()
    `

    if (sessions.length === 0) {
      return NextResponse.json({ success: false, error: "Сессия истекла" }, { status: 401 })
    }

    const currentUser = sessions[0]

    // Проверяем, что пользователь - администратор
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Доступ запрещен. Только для администраторов." },
        { status: 403 },
      )
    }

    // Проверяем, что ключ принадлежит пользователю
    const apiKey = await sql`
      SELECT * FROM api_keys WHERE id = ${keyId} AND user_id = ${currentUser.id}
    `

    if (apiKey.length === 0) {
      return NextResponse.json({ success: false, error: "API ключ не найден" }, { status: 404 })
    }

    // Удаляем ключ
    await sql`
      DELETE FROM api_keys WHERE id = ${keyId} AND user_id = ${currentUser.id}
    `

    console.log(`API key ${keyId} deleted by admin ${currentUser.full_name} (ID: ${currentUser.id})`)

    return NextResponse.json({
      success: true,
      message: "API ключ успешно удален",
    })
  } catch (error) {
    console.error("Delete API key error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при удалении API ключа",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export const dynamic = "force-dynamic"
