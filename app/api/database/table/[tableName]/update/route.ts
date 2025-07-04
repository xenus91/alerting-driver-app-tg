// app/api/database/table/[tableName]/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from '@neondatabase/serverless';

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
    // Проверка валидности столбца (без sql-тега)
    const validColumnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
    `, [tableName]);
    
    if (!validColumnsResult.rows.some(c => c.column_name === column)) {
      return NextResponse.json(
        { success: false, error: "Invalid column name" },
        { status: 400 }
      );
    }

    // Обновление данных с безопасным экранированием
    await pool.query(`
      UPDATE "${tableName.replace(/"/g, '""')}"
      SET "${column.replace(/"/g, '""')}" = $1
      WHERE id = $2
    `, [dbValue, id]);
    
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
