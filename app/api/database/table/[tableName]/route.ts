import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@neondatabase/serverless"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params
  console.log(`[API] Handling GET request for table: ${tableName}`)

  if (!process.env.DATABASE_URL) {
    console.error("[API] DATABASE_URL is not set")
    return NextResponse.json(
      { success: false, error: "Database configuration error" },
      { status: 500 }
    )
  }

  const client = await pool.connect()

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
    const validTablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `)
    const tableExists = validTablesRes.rows.some((t: any) => t.table_name === tableName)
    if (!tableExists) {
      console.error(`[API] Table ${tableName} does not exist`)
      return NextResponse.json({ success: false, error: `Table ${tableName} does not exist` }, { status: 400 })
    }

    // Проверка валидности столбцов
    const validColumnsRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName])
    const validColumnNames = validColumnsRes.rows.map((c: any) => c.column_name)

    // Формирование условий
    const searchParams = request.nextUrl.searchParams
    const filters = Object.fromEntries(searchParams.entries())
    const conditions: string[] = []
    const values: any[] = []

    for (const [column, value] of Object.entries(filters)) {
      if (value && validColumnNames.includes(column) && column !== "offset" && column !== "limit" && column !== "sortBy" && column !== "sortOrder") {
        conditions.push(`"${column}" = $${values.length + 1}`)
        values.push(value)
      } else if (value) {
        console.warn(`[API] Invalid column ${column} for table ${tableName}`)
      }
    }

    // Пагинация
    const offset = Number(searchParams.get("offset")) || 0
    const limit = Number(searchParams.get("limit")) || 10

    // Подсчёт общего количества строк
    const countQuery = `SELECT COUNT(*) as total FROM "${tableName.replace(/"/g, '""')}"${conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : ""}`
    const countResult = await client.query(countQuery, conditions.length > 0 ? values : [])
    const total = Number(countResult.rows[0].total)

    // Формирование основного запроса
    let query = `SELECT * FROM "${tableName.replace(/"/g, '""')}"`
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`
    }

    const sortBy = searchParams.get("sortBy")
    const sortOrder = searchParams.get("sortOrder")?.toUpperCase() === "DESC" ? "DESC" : "ASC"
    if (sortBy && validColumnNames.includes(sortBy)) {
      query += ` ORDER BY "${sortBy}" ${sortOrder}`
    } else if (sortBy) {
      console.warn(`[API] Invalid sort column ${sortBy} for table ${tableName}`)
    }

    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`
    values.push(limit, offset)

    console.log(`[API] Executing query for table ${tableName}: ${query}, values: ${JSON.stringify(values)}`)
    const result = await client.query(query, values)

    console.log(`[API] Query successful, returned ${result.rowCount} rows, total: ${total}`)
    return NextResponse.json({ success: true, data: result.rows, total })
  } catch (error: any) {
    console.error(`[API] Error fetching data for table ${tableName}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to fetch data for table ${tableName}: ${error.message}` },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
