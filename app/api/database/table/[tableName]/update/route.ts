// app/api/database/table/[tableName]/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from '@neondatabase/serverless';
import { sql } from '@neondatabase/serverless'; // Импортируем sql для работы с идентификаторами

export async function POST(
  request: NextRequest,
  { params }: { params: { tableName: string } }
) {
  const { tableName } = params;
  const { id, column, value } = await request.json();

  // Проверка роли пользователя
  const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
    headers: { Cookie: request.headers.get("cookie") || "" },
  });
  const authData = await authResponse.json();
  if (!authData.success || authData.user?.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  const dbValue = value === "" ? null : value;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Проверка валидности столбца
    const validColumnsQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = ${tableName}
    `;
    
    const validColumnsResult = await pool.query(validColumnsQuery);
    if (!validColumnsResult.rows.some(c => c.column_name === column)) {
      return NextResponse.json(
        { success: false, error: "Invalid column name" },
        { status: 400 }
      );
    }

    // Обновление данных с экранированием идентификаторов
    const updateQuery = sql`
      UPDATE ${sql(tableName)}
      SET ${sql(column)} = ${dbValue}
      WHERE id = ${id}
    `;
    
    await pool.query(updateQuery);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error updating table ${tableName}:`, error);
    return NextResponse.json(
      { success: false, error: `Failed to update table ${tableName}` },
      { status: 500 }
    );
  } finally {
    // Всегда закрываем пул соединений
    await pool.end();
  }
}
