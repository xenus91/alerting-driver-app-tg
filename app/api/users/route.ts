import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const users = await sql`
      SELECT id, telegram_id, phone, name, created_at
      FROM users
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      users: users,
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
