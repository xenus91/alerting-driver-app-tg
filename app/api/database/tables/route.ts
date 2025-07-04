```typescript
import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  // Проверка роли пользователя
  const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
    headers: { Cookie: request.headers.get("cookie") || "" },
  })
  const authData = await authResponse.json()
  if (!authData.success || authData.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
  }

  try {
    // Получаем список таблиц
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    const tables = await Promise.all(
      tablesResult.map(async (table: { table_name: string }) => {
        // Получаем столбцы и их типы для каждой таблицы
        const columnsResult = await sql`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${table.table_name}
          ORDER BY ordinal_position
        `
        return {
          name: table.table_name,
          columns: columnsResult.map((col: { column_name: string; data_type: string }) => ({
            name: col.column_name,
            type: col.data_type,
          })),
        }
      })
    )

    return NextResponse.json({ success: true, tables })
  } catch (error) {
    console.error("Error fetching tables:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch tables" },
      { status: 500 }
    )
  }
}
```
