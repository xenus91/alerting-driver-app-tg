import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params

  console.log(`[API] Handling GET request for table: ${tableName}`) // ИЗМЕНЕНИЕ: Добавлено логирование

  /* ИЗМЕНЕНИЕ: Улучшена обработка авторизации */
  try {
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: { Cookie: request.headers.get("cookie") || "" },
      cache: "no-store", // Предотвращаем кэширование ответа /api/auth/me
    })

    if (!authResponse.ok) {
      console.error(`[API] Auth request failed with status: ${authResponse.status}`)
      return NextResponse.json(
        { success: false, error: `Authentication endpoint failed: ${authResponse.statusText}` },
        { status: authResponse.status }
      )
    }

    const authData = await authResponse.json()
    if (!authData.success || authData.user?.role !== "admin") {
      console.warn(`[API] Access denied for table ${tableName}: user role=${authData.user?.role || "unknown"}`)
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }
    /* КОНЕЦ ИЗМЕНЕНИЯ */

    try {
      // Проверка валидности таблицы
      const validTables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `
      if (!validTables.some((t: { table_name: string }) => t.table_name === tableName)) {
        console.error(`[API] Invalid table name: ${tableName}`)
        return NextResponse.json({ success: false, error: "Invalid table name" }, { status: 400 })
      }

      // Получаем параметры фильтрации и сортировки
      const searchParams = request.nextUrl.searchParams
      const filters = Object.fromEntries(searchParams.entries())
      let query = `SELECT * FROM ${tableName}`
      const conditions: string[] = []
      const values: any[] = []

      for (const [column, value] of Object.entries(filters)) {
        if (value) {
          conditions.push(`${column} ILIKE $${values.length + 1}`)
          values.push(`%${value}%`)
        }
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`
      }

      const sortBy = searchParams.get("sortBy")
      const sortOrder = searchParams.get("sortOrder") || "ASC"
      if (sortBy) {
        query += ` ORDER BY ${sortBy} ${sortOrder}`
      }

      console.log(`[API] Executing query for table ${tableName}: ${query}, values: ${JSON.stringify(values)}`)
      const data = await sql(query, values)
      return NextResponse.json({ success: true, data })
    } catch (error) {
      console.error(`[API] Error fetching data for table ${tableName}:`, error)
      return NextResponse.json(
        { success: false, error: `Failed to fetch data for table ${tableName}` },
        { status: 500 }
      )
    }
  } catch (authError) {
    console.error(`[API] Error during authentication for table ${tableName}:`, authError)
    return NextResponse.json(
      { success: false, error: "Authentication error" },
      { status: 500 }
    )
  }
}
