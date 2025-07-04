import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params
  // Проверка роли пользователя
  const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
    headers: { Cookie: request.headers.get("cookie") || "" },
  })
  const authData = await authResponse.json()
  if (!authData.success || authData.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
  }

  try {
    // Защита от SQL-инъекций: проверяем, что tableName — валидное имя таблицы
    const validTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    if (!validTables.some((t: { table_name: string }) => t.table_name === tableName)) {
      return NextResponse.json({ success: false, error: "Invalid table name" }, { status: 400 })
    }

    // Получаем параметры фильтрации и сортировки из query
    const searchParams = request.nextUrl.searchParams
    const filters = Object.fromEntries(searchParams.entries())
    let query = `SELECT * FROM ${tableName}`
    const conditions: string[] = []
    const values: any[] = []

    // Применяем фильтры
    for (const [column, value] of Object.entries(filters)) {
      if (value) {
        conditions.push(`${column} ILIKE $${values.length + 1}`)
        values.push(`%${value}%`)
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`
    }

    // Применяем сортировку
    const sortBy = searchParams.get("sortBy")
    const sortOrder = searchParams.get("sortOrder") || "ASC"
    if (sortBy) {
      query += ` ORDER BY ${sortBy} ${sortOrder}`
    }

    const data = await sql(query, values)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(`Error fetching data for table ${tableName}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to fetch data for table ${tableName}` },
      { status: 500 }
    )
  }
}
