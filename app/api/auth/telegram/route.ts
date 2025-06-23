import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import crypto from "crypto"

const sql = neon(process.env.DATABASE_URL!)

function verifyTelegramAuth(authData: any): boolean {
  // В продакшене здесь должна быть настоящая проверка подписи Telegram
  // Для разработки пропускаем проверку, если это фиктивные данные
  if (authData.hash === "fake_hash_for_development") {
    return true
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return false
  }

  const { hash, ...data } = authData
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n")

  const secretKey = crypto.createHash("sha256").update(token).digest()
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  return hmac === hash
}

export async function POST(request: NextRequest) {
  try {
    const authData = await request.json()

    // Проверяем подпись Telegram
    if (!verifyTelegramAuth(authData)) {
      return NextResponse.json({ success: false, error: "Неверная подпись Telegram" }, { status: 400 })
    }

    // Ищем пользователя в базе данных
    const users = await sql`
      SELECT * FROM users 
      WHERE telegram_id = ${authData.id}
    `

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, error: "Пользователь не найден. Обратитесь к администратору." },
        { status: 404 },
      )
    }

    const user = users[0]

    // Проверяем роль пользователя
    if (user.role !== "operator") {
      return NextResponse.json({ success: false, error: "Доступ запрещен. Требуется роль оператора." }, { status: 403 })
    }

    // Создаем сессию
    const sessionToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней

    await sql`
      INSERT INTO user_sessions (user_id, session_token, expires_at)
      VALUES (${user.id}, ${sessionToken}, ${expiresAt})
      ON CONFLICT (user_id) DO UPDATE SET
        session_token = ${sessionToken},
        expires_at = ${expiresAt}
    `

    // Устанавливаем cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        name: user.full_name || user.name,
        role: user.role,
      },
    })

    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 дней
    })

    return response
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
