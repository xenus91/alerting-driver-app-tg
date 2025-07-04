import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const column = searchParams.get("column");

  if (!process.env.DATABASE_URL) {
    console.error("[API] DATABASE_URL is not set");
    return NextResponse.json(
      { success: false, error: "Database configuration error" },
      { status: 500 }
    );
  }

  const validColumns = [
    "id",
    "point_num",
    "point_id",
    "trip_id",
    "created_at",
    "trip_identifier",
    "point_type",
  ];

  if (!column || !validColumns.includes(column)) {
    console.error(`[API] Invalid or missing column: ${column}`);
    return NextResponse.json(
      { success: false, error: "Invalid or missing column" },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Получение типа данных столбца
    const schemaRes = await client.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'trip_points' AND column_name = $1
    `, [column]);
    if (schemaRes.rows.length === 0) {
      console.error(`[API] Column ${column} does not exist in table trip_points`);
      return NextResponse.json(
        { success: false, error: `Column ${column} does not exist` },
        { status: 400 }
      );
    }
    const dataType = schemaRes.rows[0].data_type;

    // Формирование запроса с фильтрацией NULL и пустых строк
    let query = `SELECT DISTINCT "${column}" FROM trip_points WHERE "${column}" IS NOT NULL`;
    if (["integer", "bigint"].includes(dataType)) {
      query += ` AND "${column}"::text != ''`;
    } else if (dataType === "timestamp without time zone") {
      query += ` AND "${column}"::text != ''`;
    }

    console.log(`[API] Executing distinct query for column ${column}: ${query}`);
    const result = await client.query(query);
    const values = result.rows
      .map((row) => row[column])
      .filter((value) => value !== "" && value !== null);

    console.log(
      `[API] Query successful, returned ${values.length} distinct values for ${column}`
    );
    return NextResponse.json({ success: true, data: values });
  } catch (error: any) {
    console.error(
      `[API] Error fetching distinct values for column ${column}:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch distinct values: ${error.message}`,
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
