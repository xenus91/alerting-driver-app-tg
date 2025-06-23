import * as XLSX from "xlsx"

export interface ExcelRow {
  phone?: string | number
  trip_identifier?: string | number
  vehicle_number?: string
  planned_loading_time?: string | number
  point_type?: string
  point_num?: string | number
  point_id?: string | number
  driver_comment?: string
}

export interface ValidatedRow extends ExcelRow {
  phone: string
  trip_identifier: string
  point_id: string
  point_type: "P" | "D"
  point_num: number
}

export interface TripData {
  phone: string
  trip_identifier: string
  vehicle_number?: string
  planned_loading_time?: string
  driver_comment?: string
  loading_points: Array<{ point_id: string; point_num: number }>
  unloading_points: Array<{ point_id: string; point_num: number }>
}

// Функция для конвертации Excel даты в PostgreSQL timestamp
function convertToPostgresTimestamp(excelDate: any): string | null {
  try {
    console.log(`Converting Excel date: ${excelDate} (type: ${typeof excelDate})`)

    // Если это уже строка в формате DD.MM.YYYY HH:MM
    if (typeof excelDate === "string" && excelDate.match(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)) {
      const [datePart, timePart] = excelDate.split(" ")
      const [day, month, year] = datePart.split(".")
      // Конвертируем в формат YYYY-MM-DD HH:MM:SS
      const postgresFormat = `${year}-${month}-${day} ${timePart}:00`
      console.log(`Converted ${excelDate} to ${postgresFormat}`)
      return postgresFormat
    }

    // Если это число (Excel дата)
    if (typeof excelDate === "number") {
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000)

      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const day = date.getDate().toString().padStart(2, "0")
      const hours = date.getHours().toString().padStart(2, "0")
      const minutes = date.getMinutes().toString().padStart(2, "0")

      const postgresFormat = `${year}-${month}-${day} ${hours}:${minutes}:00`
      console.log(`Converted Excel number ${excelDate} to ${postgresFormat}`)
      return postgresFormat
    }

    return null
  } catch (error) {
    console.error("Error converting date:", error)
    return null
  }
}

export function parseExcelData(buffer: ArrayBuffer): ExcelRow[] {
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

    // Конвертируем даты в правильный формат
    return data.map((row) => ({
      ...row,
      planned_loading_time: row.planned_loading_time ? convertToPostgresTimestamp(row.planned_loading_time) : undefined,
    }))
  } catch (error) {
    console.error("Error parsing Excel data:", error)
    return []
  }
}

export function validateExcelData(rows: ExcelRow[]): { valid: ValidatedRow[]; errors: string[] } {
  const valid: ValidatedRow[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Excel row number (accounting for header)

    // Проверяем обязательные поля
    if (!row.phone) {
      errors.push(`Строка ${rowNum}: отсутствует номер телефона`)
      continue
    }

    if (!row.trip_identifier) {
      errors.push(`Строка ${rowNum}: отсутствует идентификатор рейса`)
      continue
    }

    if (!row.point_id) {
      errors.push(`Строка ${rowNum}: отсутствует ID пункта`)
      continue
    }

    if (!row.point_type || !["P", "D"].includes(row.point_type.toString().toUpperCase())) {
      errors.push(`Строка ${rowNum}: неверный тип пункта (должен быть P или D)`)
      continue
    }

    // Нормализуем данные
    const validRow: ValidatedRow = {
      phone: row.phone.toString().replace(/^\+/, ""),
      trip_identifier: row.trip_identifier.toString(),
      vehicle_number: row.vehicle_number?.toString(),
      planned_loading_time: row.planned_loading_time?.toString(),
      driver_comment: row.driver_comment?.toString(),
      point_id: row.point_id.toString(),
      point_type: row.point_type.toString().toUpperCase() as "P" | "D",
      point_num: Number.parseInt(row.point_num?.toString() || "1"),
    }

    valid.push(validRow)
  }

  return { valid, errors }
}

export function groupTripsByPhone(validRows: ValidatedRow[]): TripData[] {
  const grouped = new Map<string, Map<string, TripData>>()

  // Группируем по телефону и trip_identifier
  for (const row of validRows) {
    if (!grouped.has(row.phone)) {
      grouped.set(row.phone, new Map())
    }

    const phoneGroup = grouped.get(row.phone)!
    if (!phoneGroup.has(row.trip_identifier)) {
      phoneGroup.set(row.trip_identifier, {
        phone: row.phone,
        trip_identifier: row.trip_identifier,
        vehicle_number: row.vehicle_number,
        planned_loading_time: row.planned_loading_time,
        driver_comment: row.driver_comment,
        loading_points: [],
        unloading_points: [],
      })
    }

    const tripData = phoneGroup.get(row.trip_identifier)!

    // Добавляем пункт в соответствующий массив
    if (row.point_type === "P") {
      tripData.loading_points.push({
        point_id: row.point_id,
        point_num: row.point_num,
      })
    } else {
      tripData.unloading_points.push({
        point_id: row.point_id,
        point_num: row.point_num,
      })
    }
  }

  // Преобразуем в плоский массив
  const result: TripData[] = []
  for (const phoneGroup of grouped.values()) {
    for (const tripData of phoneGroup.values()) {
      result.push(tripData)
    }
  }

  return result
}
