import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"
import crypto from "crypto"

const sql = neon(process.env.DATABASE_URL!)

// Генерация безопасного API ключа
function generateApiKey(): string {
  return `tg_${crypto.randomBytes(32).toString("hex")}`
}

// GET - получить все API ключи текущего пользователя
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("session_token")?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    // Получаем текущего пользователя
    const sessions = await sql`
      SELECT s.*, u.id, u.role, u.carpark, u.full_name
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

    // Получаем API ключи пользователя
    const apiKeys = await sql`
      SELECT id, key_name, api_key, permissions, is_active, last_used_at, created_at, expires_at
      FROM api_keys
      WHERE user_id = ${currentUser.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      apiKeys: apiKeys,
      currentUser: {
        role: currentUser.role,
        name: currentUser.full_name,
      },
    })
  } catch (error) {
    console.error("Get API keys error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении API ключей",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

// POST - создать новый API ключ
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("session_token")?.value

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    // Получаем текущего пользователя
    const sessions = await sql`
      SELECT s.*, u.id, u.role, u.carpark, u.full_name
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

    const { keyName, permissions, expiresInDays } = await request.json()

    if (!keyName || !keyName.trim()) {
      return NextResponse.json({ success: false, error: "Название ключа обязательно" }, { status: 400 })
    }

    // Генерируем API ключ
    const apiKey = generateApiKey()

    // Вычисляем дату истечения
    let expiresAt = null
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    }

    // Создаем API ключ
    const result = await sql`
      INSERT INTO api_keys (key_name, api_key, user_id, permissions, expires_at)
      VALUES (
        ${keyName.trim()}, 
        ${apiKey}, 
        ${currentUser.id}, 
        ${permissions || ["read_users"]}, 
        ${expiresAt}
      )
      RETURNING *
    `

    console.log(`API key created by admin ${currentUser.full_name} (ID: ${currentUser.id}):`, result[0])

    return NextResponse.json({
      success: true,
      apiKey: result[0],
      message: "API ключ успешно создан",
    })
  } catch (error) {
    console.error("Create API key error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при создании API ключа",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export const dynamic = "force-dynamic"
