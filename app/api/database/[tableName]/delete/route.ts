import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params
  const { id } = await request.json()

  // Проверка роли пользователя
  const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
    headers: { Cookie: request.headers.get("cookie") || "" },
  })
  const authData = await authResponse.json()
  if (!authData.success || authData.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
  }

  try {
    // Проверка валидности таблицы
    const validTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    if (!validTables.some((t: { table_name: string }) => t.table_name === tableName)) {
      return NextResponse.json({ success: false, error: "Invalid table name" }, { status: 400 })
    }

    await sql`
      DELETE FROM ${tableName}
      WHERE id = ${id}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error deleting from table ${tableName}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to delete from table ${tableName}` },
      { status: 500 }
    )
  }
}
