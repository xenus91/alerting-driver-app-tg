import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import * as XLSX from "xlsx"

interface ExcelRow {
  phone?: string | number
  trip_identifier?: string | number
  vehicle_number?: string
  planned_loading_time?: string | number
  point_type?: string
  point_num?: string | number
  point_id?: string | number
  driver_comment?: string
}

// Функция для конвертации Excel даты в строку
function convertExcelDate(excelDate: any): string {
  try {
    console.log(`Converting Excel date: ${excelDate} (type: ${typeof excelDate})`)

    // Если это уже строка в правильном формате, возвращаем как есть
    if (typeof excelDate === "string") {
      // Проверяем, соответствует ли формату DD.MM.YYYY HH:MM
      if (excelDate.match(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)) {
        return excelDate
      }
      return excelDate
    }

    // Если это число (Excel дата)
    if (typeof excelDate === "number") {
      // Excel считает дни с 1 января 1900 года (но с ошибкой в 1900 году)
      const excelEpoch = new Date(1899, 11, 30) // 30 декабря 1899
      const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000)

      // Форматируем в DD.MM.YYYY HH:MM
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const year = date.getFullYear()
      const hours = date.getHours().toString().padStart(2, "0")
      const minutes = date.getMinutes().toString().padStart(2, "0")

      const formatted = `${day}.${month}.${year} ${hours}:${minutes}`
      console.log(`Converted Excel date ${excelDate} to ${formatted}`)
      return formatted
    }

    // Если это объект Date
    if (excelDate instanceof Date) {
      const day = excelDate.getDate().toString().padStart(2, "0")
      const month = (excelDate.getMonth() + 1).toString().padStart(2, "0")
      const year = excelDate.getFullYear()
      const hours = excelDate.getHours().toString().padStart(2, "0")
      const minutes = excelDate.getMinutes().toString().padStart(2, "0")

      return `${day}.${month}.${year} ${hours}:${minutes}`
    }

    // Если ничего не подошло, возвращаем как строку
    return excelDate.toString()
  } catch (error) {
    console.error("Error converting Excel date:", error)
    return excelDate.toString()
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}`)

    // Читаем файл
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false }) // Отключаем автоматическое преобразование дат
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const excelData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

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
    const groupedData = new Map<string, Map<string, ExcelRow[]>>()

    for (const row of excelData) {
      const phone = row.phone?.toString().replace(/^\+/, "") || ""
      const tripIdentifier = row.trip_identifier?.toString() || ""

      if (!phone || !tripIdentifier) {
        continue
      }

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

          // Конвертируем дату
          const plannedLoadingTime = convertExcelDate(firstRow.planned_loading_time)
          console.log(`Converted planned loading time: ${plannedLoadingTime}`)

          // Проверяем существование всех пунктов для этого рейса
          const pointIds = [...new Set(tripData.map((row) => row.point_id?.toString()).filter(Boolean))]

          if (pointIds.length === 0) {
            results.errors++
            results.details.push({
              phone,
              trip_identifier: tripIdentifier,
              status: "error",
              error: "Не указаны пункты для рейса",
              user_name: user.first_name || user.name,
            })
            continue
          }

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
              ${plannedLoadingTime}, ${firstRow.driver_comment || null}
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
        success: false,
        error: "Ошибка при обработке файла",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
