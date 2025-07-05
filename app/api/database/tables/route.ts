import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  console.log("[API] 🚀 Handling GET request for /api/database/tables")

  if (!process.env.DATABASE_URL) {
    console.error("[API] ❌ DATABASE_URL is not set")
    return NextResponse.json(
      { success: false, error: "Database configuration error" },
      { status: 500 }
    )
  }

  try {
    // Проверка авторизации
    console.log("[API] 🔒 Checking authentication...")
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: { Cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    })
    
    if (!authResponse.ok) {
      console.error(`[API] ❌ Auth request failed with status: ${authResponse.status}, ${authResponse.statusText}`)
      return NextResponse.json(
        { success: false, error: `Authentication endpoint failed: ${authResponse.statusText}` },
        { status: authResponse.status }
      )
    }
    
    const authData = await authResponse.json()
    if (!authData.success || authData.user?.role !== "admin") {
      console.warn(`[API] ⚠️ Access denied for tables: user role=${authData.user?.role || "unknown"}`)
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }
    console.log("[API] 🔓 Authentication successful")

    // Получение списка таблиц
    console.log("[API] 📋 Retrieving list of tables...")
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    console.log(`[API] ✅ Found ${tables.length} tables`)

    // Получение столбцов для каждой таблицы
    const tableData = []
    console.log("[API] 🔍 Processing tables and columns...")
    
    for (const table of tables) {
      console.log(`[API] 🧩 Processing table: ${table.table_name}`)
      const columns = await sql`
        SELECT 
          column_name AS name, 
          data_type AS type,
          udt_name AS udt_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table.table_name}
        ORDER BY ordinal_position
      `
      console.log(`[API]   ➕ Found ${columns.length} columns in table ${table.table_name}`)

      // Для enum-колонок получаем возможные значения
      const enhancedColumns = await Promise.all(
        columns.map(async (column) => {
          // Проверяем, является ли тип enum
          const isEnumType = column.type === 'USER-DEFINED' || 
                            column.udt_type.startsWith('enum_') ||
                            column.udt_type === 'trip_messages_status';
          
          if (isEnumType) {
            console.log(`[API]   🔍 Detected enum column: ${column.name} (udt_type: ${column.udt_type})`)
            
            try {
              // Логируем запрос для отладки
              const enumQuery = `
                SELECT e.enumlabel AS value
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = '${column.udt_type}'
              `;
              console.log(`[API]   🔍 Executing enum query: ${enumQuery}`)
              
              const enumValues = await sql`
                SELECT e.enumlabel AS value
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = ${column.udt_type}
              `
              
              console.log(`[API]   ✅ Found ${enumValues.length} enum values for ${column.udt_type}:`, 
                          enumValues.map(v => v.value))
              
              return {
                ...column,
                enumValues: enumValues.map(row => row.value)
              }
            } catch (error) {
              console.error(`[API] ❌ Failed to get enum values for ${column.udt_type}:`, error)
              return column
            }
          }
          return column
        })
      )

      tableData.push({
        name: table.table_name,
        columns: enhancedColumns,
      })
      
      console.log(`[API] ✅ Finished processing table: ${table.table_name}`)
    }

    console.log(`[API] 🎉 Retrieved ${tableData.length} tables with enhanced columns`)
    return NextResponse.json({ success: true, tables: tableData })
  } catch (error) {
    console.error("[API] ❌ Error fetching tables:", error)
    return NextResponse.json(
      { success: false, error: `Failed to fetch tables: ${error.message}` },
      { status: 500 }
    )
  }
}
