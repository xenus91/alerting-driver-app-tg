import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params
  console.log(`[API] Handling GET request for table: ${tableName}`)

  // Проверка переменной окружения
  if (!process.env.DATABASE_URL) {
    console.error("[API] DATABASE_URL is not set")
    return NextResponse.json(
      { success: false, error: "Database configuration error" },
      { status: 500 }
    )
  }

  try {
    // Проверка авторизации
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: { Cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    })
    if (!authResponse.ok) {
      console.error(`[API] Auth request failed with status: ${authResponse.status}, ${authResponse.statusText}`)
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

    // Проверка валидности таблицы
    console.log(`[API] Checking if table ${tableName} exists in public schema`)
    const validTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    const tableExists = validTables.some((t: { table_name: string }) => t.table_name === tableName)
    if (!tableExists) {
      console.error(`[API] Table ${tableName} does not exist`)
      return NextResponse.json({ success: false, error: `Table ${tableName} does not exist` }, { status: 400 })
    }

    // Формирование запроса с использованием тегированного шаблона
    const searchParams = request.nextUrl.searchParams
    const filters = Object.fromEntries(searchParams.entries())
    const conditions: string[] = []
    const values: any[] = []

    // Проверка валидности столбцов для фильтрации
    const validColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
    `
    for (const [column, value] of Object.entries(filters)) {
      if (value && validColumns.some((c: { column_name: string }) => c.column_name === column)) {
        conditions.push(`${column} ILIKE $${values.length + 1}`)
        values.push(`%${value}%`)
      } else if (value) {
        console.warn(`[API] Invalid column ${column} for table ${tableName}`)
      }
    }

    // Формируем запрос с использованием тегированного шаблона
    let query = `SELECT * FROM ${tableName}`
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`
    }

    // Проверка валидности столбца для сортировки
    const sortBy = searchParams.get("sortBy")
    const sortOrder = searchParams.get("sortOrder") || "ASC"
    if (sortBy && validColumns.some((c: { column_name: string }) => c.column_name === sortBy)) {
      query += ` ORDER BY ${sortBy} ${sortOrder}`
    } else if (sortBy) {
      console.warn(`[API] Invalid sort column ${sortBy} for table ${tableName}`)
    }

    console.log(`[API] Executing query for table ${tableName}: ${query}, values: ${JSON.stringify(values)}`)
    const data = await sql(query, values)
    console.log(`[API] Query successful, returned ${data.length} rows`)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(`[API] Error fetching data for table ${tableName}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to fetch data for table ${tableName}: ${error.message}` },
      { status: 500 }
    )
  }
}
