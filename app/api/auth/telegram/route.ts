import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import crypto from "crypto"

export const dynamic = "force-dynamic"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    const authData = await request.json()

    console.log("=== AUTH REQUEST ===")
    console.log("Auth data:", authData)

    // Ищем пользователя в базе данных по telegram_id
    const users = await sql`
      SELECT * FROM users 
      WHERE telegram_id = ${authData.id}
    `

    console.log("Found users:", users)

    if (users.length === 0) {
      console.log("❌ User not found")
      return NextResponse.json(
        { success: false, error: "Пользователь не найден. Обратитесь к администратору." },
        { status: 404 },
      )
    }

    const user = users[0]
    console.log("User found:", user)

    // Проверяем роль пользователя
    if (user.role !== "operator") {
      console.log("❌ User is not an operator, role:", user.role)
      return NextResponse.json({ success: false, error: "Доступ запрещен. Требуется роль оператора." }, { status: 403 })
    }

    console.log("✅ User is operator, creating session")

    // Создаем сессию
    const sessionToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней

    // Сначала удаляем старые сессии пользователя
    await sql`
      DELETE FROM user_sessions WHERE user_id = ${user.id}
    `

    // Затем создаем новую сессию
    await sql`
      INSERT INTO user_sessions (user_id, session_token, expires_at)
      VALUES (${user.id}, ${sessionToken}, ${expiresAt.toISOString()})
    `

    console.log("✅ Session created")

    // Устанавливаем cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        name: user.full_name || user.first_name || user.name,
        role: user.role,
        carpark: user.carpark,
      },
    })

    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 дней
    })

    console.log("✅ Auth successful")
    return response
  } catch (error) {
    console.error("❌ Auth error:", error)
    return NextResponse.json({ success: false, error: "Внутренняя ошибка сервера: " + error.message }, { status: 500 })
  }
}
