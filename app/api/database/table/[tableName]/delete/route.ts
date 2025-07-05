// app/api/database/table/[tableName]/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from '@neondatabase/serverless';

export async function POST(
  request: NextRequest,
  { params }: { params: { tableName: string } }
) {
  const { tableName } = params;
  const { id } = await request.json();

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

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Проверка валидности таблицы
    const validTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    const tableExists = validTablesResult.rows.some(
      (t: any) => t.table_name === tableName
    );
    
    if (!tableExists) {
      return NextResponse.json(
        { success: false, error: "Invalid table name" },
        { status: 400 }
      );
    }

    // Проверка существования столбца id
    const validColumnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = 'id'
    `, [tableName]);
    
    if (validColumnsResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Table does not have an 'id' column" },
        { status: 400 }
      );
    }

    // Безопасное выполнение запроса
    await pool.query(
      `DELETE FROM "${tableName.replace(/"/g, '""')}" WHERE id = $1`,
      [id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting from table ${tableName}:`, error);
    return NextResponse.json(
      { success: false, error: `Failed to delete from table ${tableName}` },
      { status: 500 }
    );
  } finally {
    // Обязательно закрываем пул соединений
    await pool.end();
  }
}
