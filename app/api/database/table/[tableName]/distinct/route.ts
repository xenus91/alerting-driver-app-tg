import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@neondatabase/serverless"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: NextRequest, { params }: { params: { tableName: string } }) {
  const { tableName } = params
  const column = request.nextUrl.searchParams.get("column")

  console.log(`[API] Handling GET distinct values for table: ${tableName}, column: ${column}`)

  if (!process.env.DATABASE_URL) {
    console.error("[API] DATABASE_URL is not set")
    return NextResponse.json(
      { success: false, error: "Database configuration error" },
      { status: 500 }
    )
  }

  if (!column) {
    console.error("[API] Column parameter is missing")
    return NextResponse.json(
      { success: false, error: "Column parameter is required" },
      { status: 400 }
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

    // Проверка валидности столбца
    const validColumnsRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName])
    const validColumnNames = validColumnsRes.rows.map((c: any) => c.column_name)
    if (!validColumnNames.includes(column)) {
      console.error(`[API] Column ${column} does not exist in table ${tableName}`)
      return NextResponse.json(
        { success: false, error: `Column ${column} does not exist in table ${tableName}` },
        { status: 400 }
      )
    }

    // Запрос уникальных значений
    const query = `SELECT DISTINCT "${column}" FROM "${tableName.replace(/"/g, '""')}" WHERE "${column}" IS NOT NULL ORDER BY "${column}"`
    console.log(`[API] Executing distinct query for table ${tableName}, column ${column}: ${query}`)
    const result = await client.query(query)

    const values = result.rows.map((row: any) => row[column])
    console.log(`[API] Query successful, returned ${values.length} distinct values`)
    return NextResponse.json({ success: true, data: values })
  } catch (error: any) {
    console.error(`[API] Error fetching distinct values for table ${tableName}, column ${column}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to fetch distinct values: ${error.message}` },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
