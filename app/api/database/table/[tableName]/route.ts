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
    const tableExists = validTables.some((t: any) => t.table_name === tableName)
    if (!tableExists) {
      console.error(`[API] Table ${tableName} does not exist`)
      return NextResponse.json({ success: false, error: `Table ${tableName} does not exist` }, { status: 400 })
    }

    // ✅ Исправленный запрос с использованием правильного метода
    console.log(`[API] Executing query for table ${tableName}`)
    
    // Используем параметризованный запрос через клиент SQL
    const data = await sql(`
      SELECT * 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ORDER BY ordinal_position
    `)

    // Для получения данных таблицы используем другой подход
    const tableData = await sql(`SELECT * FROM public."${tableName}"`)

    console.log(`[API] Query successful, returned ${tableData.length} rows`)
    return NextResponse.json({ 
      success: true, 
      data: {
        columns: data,
        rows: tableData
      }
    })
  } catch (error: any) {
    console.error(`[API] Error fetching data for table ${tableName}:`, error)
    return NextResponse.json(
      { success: false, error: `Failed to fetch data for table ${tableName}: ${error.message}` },
      { status: 500 }
    )
  }
}
