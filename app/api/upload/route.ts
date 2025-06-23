import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { parseExcelData } from "@/lib/excel"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}`)

    // Парсим Excel файл
    const excelData = await parseExcelData(file)
    console.log(`Parsed ${excelData.length} rows from Excel`)

    if (excelData.length === 0) {
      return NextResponse.json({ error: "Файл пуст или имеет неправильный формат" }, { status: 400 })
    }

    // Создаем новый рейс
    const tripResult = await sql`
      INSERT INTO trips (status) VALUES ('active')
      RETURNING id
    `
    const tripId = tripResult.rows[0].id
    console.log(`Created trip with ID: ${tripId}`)

    const results = {
      total: 0,
      processed: 0,
      errors: 0,
      unverified_users: 0,
      missing_points: 0,
      details: [] as any[],
    }

    // Группируем данные по телефону и trip_identifier
    const groupedData = new Map<string, Map<string, typeof excelData>>()

    for (const row of excelData) {
      const phone = row.phone?.toString().replace(/^\+/, "") || ""
      const tripIdentifier = row.trip_identifier?.toString() || ""

      if (!groupedData.has(phone)) {
        groupedData.set(phone, new Map())
      }
      if (!groupedData.get(phone)!.has(tripIdentifier)) {
        groupedData.get(phone)!.set(tripIdentifier, [])
      }
      groupedData.get(phone)!.get(tripIdentifier)!.push(row)
    }

    // Обрабатываем каждый телефон
    for (const [phone, tripsByIdentifier] of groupedData) {
      try {
        results.total++

        // Проверяем существование пользователя
        const userResult = await sql`SELECT * FROM users WHERE phone = ${phone}`
        const user = userResult.rows[0]

        if (!user) {
          results.errors++
          results.details.push({
            phone,
            status: "error",
            error: "Пользователь не найден в системе",
          })
          continue
        }

        // ПРОВЕРЯЕМ ВЕРИФИКАЦИЮ ПОЛЬЗОВАТЕЛЯ
        if (!user.verified) {
          results.unverified_users++
          results.details.push({
            phone,
            status: "error",
            error: "Пользователь не верифицирован. Сообщение не будет отправлено.",
            user_name: user.first_name || user.name,
          })
          continue
        }

        // Обрабатываем каждый trip_identifier для этого пользователя
        for (const [tripIdentifier, tripData] of tripsByIdentifier) {
          const firstRow = tripData[0]

          // Проверяем существование всех пунктов для этого рейса
          const pointIds = [...new Set(tripData.map((row) => row.point_id?.toString()).filter(Boolean))]
          const pointsResult = await sql`
            SELECT point_id FROM points WHERE point_id = ANY(${pointIds})
          `
          const existingPoints = new Set(pointsResult.rows.map((p) => p.point_id))
          const missingPoints = pointIds.filter((id) => !existingPoints.has(id))

          if (missingPoints.length > 0) {
            results.missing_points++
            results.details.push({
              phone,
              trip_identifier: tripIdentifier,
              status: "error",
              error: `Пункты не найдены в системе: ${missingPoints.join(", ")}`,
              user_name: user.first_name || user.name,
            })
            continue
          }

          // Создаем сообщение для рейса
          const messageResult = await sql`
            INSERT INTO trip_messages (
              trip_id, phone, message, telegram_id, response_status,
              trip_identifier, vehicle_number, planned_loading_time, driver_comment
            )
            VALUES (
              ${tripId}, ${phone}, 'Pending message', ${user.telegram_id || null}, 'pending',
              ${tripIdentifier}, ${firstRow.vehicle_number || null}, 
              ${firstRow.planned_loading_time || null}, ${firstRow.driver_comment || null}
            )
            RETURNING id
          `
          const messageId = messageResult.rows[0].id

          // Создаем записи trip_points для каждого пункта
          for (const row of tripData) {
            if (row.point_id) {
              await sql`
                INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier)
                VALUES (${tripId}, ${row.point_id}, ${row.point_type}, ${row.point_num || 1}, ${tripIdentifier})
              `
            }
          }

          console.log(`Created message ${messageId} for trip ${tripIdentifier}, phone ${phone}`)
        }

        results.processed++
        results.details.push({
          phone,
          status: "success",
          user_name: user.first_name || user.name,
          trips_count: tripsByIdentifier.size,
        })
      } catch (error) {
        console.error(`Error processing phone ${phone}:`, error)
        results.errors++
        results.details.push({
          phone,
          status: "error",
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        })
      }
    }

    console.log(`Upload processing complete:`, results)

    return NextResponse.json({
      success: true,
      tripId,
      results,
      message: `Обработано: ${results.processed}, Ошибок: ${results.errors}, Неверифицированных: ${results.unverified_users}, Отсутствующих пунктов: ${results.missing_points}`,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при обработке файла",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
