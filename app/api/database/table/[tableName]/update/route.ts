import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params
  const { id, column, value } = await request.json()

  // Проверка роли пользователя
  const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
    headers: { Cookie: request.headers.get("cookie") || "" },
  })
  const authData = await authResponse.json()
  if (!authData.success || authData.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
  }

  try {
    // Проверка валидности таблицы и столбца
    const validColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
    `
    if (!validColumns.some((c: { column_name: string }) => c.column_name === column)) {
      return NextResponse.json({ success: false, error: "Invalid column name" }, { status: 400 })
    }

    await sql`
      UPDATE ${tableName}
      SET ${column} = ${value}
      WHERE id = ${id}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error updating table ${tableName}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to update table ${tableName}` },
      { status: 500 }
    )
  }
}
