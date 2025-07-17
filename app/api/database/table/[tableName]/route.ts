// app/api/database/table/[tableName]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const NULL_PLACEHOLDER = "__NULL__"; // Должен соответствовать фронтенду

// Добавлено: Разрешение для доступа к таблицам
const API_KEY_PERMISSION = "read_database";

export async function GET(
  request: NextRequest,
  { params }: { params: { tableName: string } }
) {
  const { tableName } = params;
  console.log(`[API] Handling GET request for table: ${tableName}`);

  if (!process.env.DATABASE_URL) {
    console.error("[API] DATABASE_URL is not set");
    return NextResponse.json(
      { success: false, error: "Database configuration error" },
      { status: 500 }
    );
  }

  const client = await pool.connect();

  try {
    // Добавлено: Проверка API ключа
    let hasAccess = false;
    const apiKey = 
      request.headers.get("X-API-Key") ||
      request.headers.get("Authorization")?.replace("Bearer ", "");
    
    if (apiKey) {
      console.log(`[API] Checking API key access for table: ${tableName}`);
      
      // Проверяем валидность ключа и наличие разрешения
      const keyCheck = await client.query(
        `SELECT * FROM api_keys 
         WHERE api_key = $1 
           AND is_active = true 
           AND (expires_at IS NULL OR expires_at > NOW())
           AND $2 = ANY(permissions)`,
        [apiKey, API_KEY_PERMISSION]
      );
      
      if (keyCheck.rowCount > 0) {
        console.log(`[API] Valid API key used for table: ${tableName}`);
        hasAccess = true;
        
        // Обновляем время последнего использования
        await client.query(
          `UPDATE api_keys 
           SET last_used_at = NOW() 
           WHERE id = $1`,
          [keyCheck.rows[0].id]
        );
      }
    }
    
    // Добавлено: Если нет доступа по API ключу, проверяем сессию администратора
    if (!hasAccess) {
      console.log(`[API] No valid API key, checking session for table: ${tableName}`);
      const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
        headers: { Cookie: request.headers.get("cookie") || "" },
        cache: "no-store",
      });
      
      if (!authResponse.ok) {
        console.error(
          `[API] Auth request failed with status: ${authResponse.status}, ${authResponse.statusText}`
        );
        return NextResponse.json(
          {
            success: false,
            error: `Authentication endpoint failed: ${authResponse.statusText}`,
          },
          { status: authResponse.status }
        );
      }
      
      const authData = await authResponse.json();
      if (!authData.success || authData.user?.role !== "admin") {
        console.warn(`[API] Access denied for table ${tableName}`);
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
      
      hasAccess = true;
    }
    
    // Добавлено: Если доступ не получен ни одним способом
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }


    // Проверка валидности таблицы
    console.log(`[API] Checking if table ${tableName} exists in public schema`);
    const validTablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tableExists = validTablesRes.rows.some(
      (t: any) => t.table_name === tableName
    );
    if (!tableExists) {
      console.error(`[API] Table ${tableName} does not exist`);
      return NextResponse.json(
        { success: false, error: `Table ${tableName} does not exist` },
        { status: 400 }
      );
    }

    // Получение схемы таблицы
    const schemaRes = await client.query(
      `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
      [tableName]
    );
    const columnSchema = schemaRes.rows.reduce((acc: any, col: any) => {
      acc[col.column_name] = col.data_type;
      return acc;
    }, {});

    // Обработка параметров запроса
    const searchParams = request.nextUrl.searchParams;
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Сбор всех параметров фильтра
    const filters: { [key: string]: any } = {};
    
    // Специальная обработка для массивов значений
    const valueArrays: { [key: string]: string[] } = {};
    
    searchParams.forEach((value, key) => {
      const match = key.match(/filter\[(\d+)\]\.(\w+)/);
      if (match) {
        const index = match[1];
        const field = match[2];
        
        if (!filters[index]) filters[index] = {};
        
        // Для value собираем массив
        if (field === 'value') {
          if (!valueArrays[index]) valueArrays[index] = [];
          valueArrays[index].push(value);
        } else {
          filters[index][field] = value;
        }
      }
    });

    // Объединяем массивы значений с основными фильтрами
    Object.keys(filters).forEach(index => {
      if (valueArrays[index]) {
        filters[index].value = valueArrays[index];
      }
    });

    // Преобразование в массив и сортировка по индексу
    const filterArray = Object.entries(filters)
      .map(([index, data]) => ({ index: parseInt(index), ...data }))
      .sort((a, b) => a.index - b.index);

    // Обработка фильтров
    for (const filter of filterArray) {
      const { column, operator, value, connector } = filter;
      
      if (!column || !operator) continue;
      
      // Проверка существования колонки
      if (!columnSchema[column]) {
        console.warn(`[API] Invalid column ${column} for table ${tableName}`);
        continue;
      }
      
      // Обработка NULL-значений
      if (value === NULL_PLACEHOLDER) {
        if (operator === "=") {
          if (conditions.length > 0) {
            conditions.push(connector || 'AND');
          }
          conditions.push(`"${column}" IS NULL`);
        } else if (operator === "!=") {
          if (conditions.length > 0) {
            conditions.push(connector || 'AND');
          }
          conditions.push(`"${column}" IS NOT NULL`);
        }
        continue;
      }
      
      // Обработка операторов
      switch (operator) {
        case "=":
        case "!=":
        case ">":
        case "<":
        case ">=":
        case "<=":
          if (conditions.length > 0) {
            conditions.push(connector || 'AND');
          }
          conditions.push(`"${column}" ${operator} $${paramIndex}`);
          values.push(value);
          paramIndex++;
          break;
          
        case "like":
          if (conditions.length > 0) {
            conditions.push(connector || 'AND');
          }
          conditions.push(`"${column}" ILIKE $${paramIndex}`);
          values.push(`%${value}%`);
          paramIndex++;
          break;
          
        case "in":
        case "not in":
          // value должен быть массивом
          const valueArray = Array.isArray(value) ? value : [value];
          if (valueArray.length === 0) continue;
          
          // Заменяем NULL_PLACEHOLDER на пустые строки
          const cleanValues = valueArray.map(v => 
            v === NULL_PLACEHOLDER ? "" : v
          );
          
          const placeholders = cleanValues.map((_, i) => `$${paramIndex + i}`).join(",");
          if (conditions.length > 0) {
            conditions.push(connector || 'AND');
          }
          conditions.push(
            `"${column}" ${operator === "in" ? "IN" : "NOT IN"} (${placeholders})`
          );
          values.push(...cleanValues);
          paramIndex += cleanValues.length;
          break;
          
        default:
          console.warn(`[API] Unsupported operator: ${operator}`);
          continue;
      }
    }

    // Сортировка
    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder") === "DESC" ? "DESC" : "ASC";
    let orderBy = "";
    if (sortBy && columnSchema[sortBy]) {
      orderBy = ` ORDER BY "${sortBy}" ${sortOrder}`;
    } else if (sortBy) {
      console.warn(`[API] Invalid sort column ${sortBy} for table ${tableName}`);
    }

    // Пагинация
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Подсчёт общего количества строк
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' ')}` : '';
    const countQuery = `SELECT COUNT(*) as total FROM "${tableName}" ${whereClause}`;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Формирование основного запроса
    const query = `SELECT * FROM "${tableName}" ${whereClause} ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    console.log(`[API] Executing query: ${query}`, values);
    const result = await client.query(query, values);

    // Преобразование пустых строк в null
    const transformedData = result.rows.map((row: any) => {
      const newRow: any = {};
      for (const [key, val] of Object.entries(row)) {
        newRow[key] = val === "" ? null : val;
      }
      return newRow;
    });

    return NextResponse.json({
      success: true,
      data: transformedData,
      total,
    });
  } catch (error: any) {
    console.error(`[API] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch data: ${error.message}`,
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
