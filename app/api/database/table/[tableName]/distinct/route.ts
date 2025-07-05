import { NextRequest, NextResponse } from "next/server";
import { Pool } from '@neondatabase/serverless';

export async function GET(
  request: NextRequest,
  { params }: { params: { tableName: string } }
) {
  const { tableName } = params;
  const column = request.nextUrl.searchParams.get('column');
  
  if (!column) {
    return NextResponse.json(
      { success: false, error: "Column parameter is required" },
      { status: 400 }
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Проверка валидности столбца
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

    // Получение уникальных значений
    const result = await pool.query(`
      SELECT DISTINCT "${column.replace(/"/g, '""')}" as value
      FROM "${tableName.replace(/"/g, '""')}"
    `);
    
    const values = result.rows
      .map(row => row.value)
      .filter(value => value !== null && value !== undefined);
    
    return NextResponse.json({
      success: true,
      data: values,
    });
  } catch (error) {
    console.error(`Error getting distinct values for ${tableName}.${column}:`, error);
    return NextResponse.json(
      { success: false, error: `Failed to get distinct values` },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
