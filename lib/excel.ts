import * as XLSX from "xlsx"

export interface ExcelRow {
  phone: string
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  point_type: "P" | "D"
  point_num: number
  point_id: string
  driver_comment: string
}

export interface TripData {
  phone: string
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  loading_points: Array<{
    point_num: number
    point_id: string
  }>
  unloading_points: Array<{
    point_num: number
    point_id: string
  }>
}

// Функция для конвертации Excel даты в строку
function convertExcelDate(excelDate: any): string {
  try {
    // Если это уже строка, возвращаем как есть
    if (typeof excelDate === "string") {
      return excelDate
    }

    // Если это число (Excel дата)
    if (typeof excelDate === "number") {
      // Excel считает дни с 1 января 1900 года
      const excelEpoch = new Date(1900, 0, 1)
      const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000)

      // Форматируем в DD.MM.YYYY HH:MM
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const year = date.getFullYear()
      const hours = date.getHours().toString().padStart(2, "0")
      const minutes = date.getMinutes().toString().padStart(2, "0")

      return `${day}.${month}.${year} ${hours}:${minutes}`
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

export function parseExcelData(buffer: ArrayBuffer): ExcelRow[] {
  try {
    console.log("Parsing Excel file, buffer size:", buffer.byteLength)

    // Читаем Excel файл
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true })

    // Получаем первый лист
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      throw new Error("Excel файл не содержит листов")
    }

    const worksheet = workbook.Sheets[sheetName]

    // Конвертируем в JSON с заголовками
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Возвращает массив массивов
      defval: "", // Значение по умолчанию для пустых ячеек
      raw: false, // Не использовать raw значения для дат
    }) as string[][]

    console.log("Parsed JSON data:", jsonData)

    if (jsonData.length === 0) {
      throw new Error("Excel файл пустой")
    }

    // Получаем заголовки (первая строка)
    const headers = jsonData[0]
    console.log("Headers:", headers)

    // Проверяем наличие обязательных колонок
    const requiredColumns = [
      "phone",
      "trip_identifier",
      "vehicle_number",
      "planned_loading_time",
      "point_type",
      "point_num",
      "point_id",
      "driver_comment",
    ]

    const missingColumns = requiredColumns.filter((col) => !headers.includes(col))
    if (missingColumns.length > 0) {
      throw new Error(`Отсутствуют обязательные колонки: ${missingColumns.join(", ")}`)
    }

    // Получаем индексы колонок
    const columnIndexes = {
      phone: headers.indexOf("phone"),
      trip_identifier: headers.indexOf("trip_identifier"),
      vehicle_number: headers.indexOf("vehicle_number"),
      planned_loading_time: headers.indexOf("planned_loading_time"),
      point_type: headers.indexOf("point_type"),
      point_num: headers.indexOf("point_num"),
      point_id: headers.indexOf("point_id"),
      driver_comment: headers.indexOf("driver_comment"),
    }

    // Пропускаем заголовок (первую строку)
    const dataRows = jsonData.slice(1)
    const rows: ExcelRow[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]

      // Пропускаем пустые строки
      if (!row || row.length === 0 || !row.some((cell) => cell && cell.toString().trim())) {
        continue
      }

      try {
        const phone = row[columnIndexes.phone] ? row[columnIndexes.phone].toString().trim() : ""
        const trip_identifier = row[columnIndexes.trip_identifier]
          ? row[columnIndexes.trip_identifier].toString().trim()
          : ""
        const vehicle_number = row[columnIndexes.vehicle_number]
          ? row[columnIndexes.vehicle_number].toString().trim()
          : ""

        // Специальная обработка даты
        const planned_loading_time = convertExcelDate(row[columnIndexes.planned_loading_time])

        const point_type = row[columnIndexes.point_type]
          ? (row[columnIndexes.point_type].toString().trim() as "P" | "D")
          : "P"
        const point_num = row[columnIndexes.point_num] ? Number.parseInt(row[columnIndexes.point_num].toString()) : 0
        const point_id = row[columnIndexes.point_id] ? row[columnIndexes.point_id].toString().trim() : ""
        const driver_comment = row[columnIndexes.driver_comment]
          ? row[columnIndexes.driver_comment].toString().trim()
          : ""

        console.log(`Row ${i + 2}:`, {
          phone,
          trip_identifier,
          vehicle_number,
          planned_loading_time,
          point_type,
          point_num,
          point_id,
          driver_comment,
        })

          if (phone && trip_identifier && vehicle_number && planned_loading_time && point_id) {
        rows.push({
          phone, // сохраняем оригинальное значение
          trip_identifier,
          vehicle_number,
          planned_loading_time,
          point_type,
          point_num,
          point_id,
          driver_comment,
        })
          } else {
            console.warn(`Строка ${i + 2}: неверный формат номера - "${phone}"`)
          }
        } else {
          console.warn(`Строка ${i + 2}: пропущена из-за отсутствия обязательных данных`)
        }
      } catch (error) {
        console.error(`Ошибка обработки строки ${i + 2}:`, error)
      }
    }

    console.log("Successfully parsed rows:", rows.length)
    return rows
  } catch (error) {
    console.error("Error parsing Excel data:", error)

    // Если это не Excel файл, пробуем как CSV
    if (error instanceof Error && error.message.includes("Unsupported file")) {
      return parseCSVData(buffer)
    }

    throw new Error(
      `Ошибка при обработке Excel файла: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
    )
  }
}

function parseCSVData(buffer: ArrayBuffer): ExcelRow[] {
  try {
    const text = new TextDecoder().decode(buffer)
    const lines = text.split(/\r?\n/).filter((line) => line.trim())

    if (lines.length === 0) {
      throw new Error("CSV файл пустой")
    }

    // Получаем заголовки
    const headers = lines[0].split(/\t|;|,/)
    console.log("CSV Headers:", headers)

    // Пропускаем заголовок
    const dataLines = lines.slice(1)
    const rows: ExcelRow[] = []

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim()
      if (!line) continue

      // Пробуем разные разделители
      let parts: string[] = []

      if (line.includes("\t")) {
        parts = line.split("\t")
      } else if (line.includes(";")) {
        parts = line.split(";")
      } else if (line.includes(",")) {
        parts = line.split(",")
      }

      if (parts.length < 8) {
        console.warn(`CSV строка ${i + 2}: недостаточно данных - "${line}"`)
        continue
      }

      try {
        const phone = parts[0].trim().replace(/['"]/g, "")
        const trip_identifier = parts[1].trim().replace(/['"]/g, "")
        const vehicle_number = parts[2].trim().replace(/['"]/g, "")
        const planned_loading_time = parts[3].trim().replace(/['"]/g, "")
        const point_type = parts[4].trim().replace(/['"]/g, "") as "P" | "D"
        const point_num = Number.parseInt(parts[5].trim().replace(/['"]/g, ""))
        const point_id = parts[6].trim().replace(/['"]/g, "")
        const driver_comment = parts[7].trim().replace(/['"]/g, "")

        if (phone && trip_identifier && vehicle_number && planned_loading_time && point_id) {
        rows.push({
          phone, // оригинальное значение
          trip_identifier,
          vehicle_number,
          planned_loading_time,
          point_type,
          point_num,
          point_id,
          driver_comment,
        })
          }
        }
      } catch (error) {
        console.error(`Ошибка обработки CSV строки ${i + 2}:`, error)
      }
    }

    return rows
  } catch (error) {
    throw new Error("Ошибка при обработке CSV файла")
  }
}
{/*
function normalizePhone(phone: string): string | null {
  // Удаляем все символы кроме цифр и +
  const cleaned = phone.replace(/[^\d+]/g, "")

  console.log(`Normalizing phone: "${phone}" -> "${cleaned}"`)

  // Возвращаем номер БЕЗ знака + (как в базе данных)
  if (cleaned.startsWith("+7") && cleaned.length === 12) {
    // +79050550020 -> 79050550020
    return cleaned.slice(1)
  } else if (cleaned.startsWith("8") && cleaned.length === 11) {
    // 89050550020 -> 79050550020
    return "7" + cleaned.slice(1)
  } else if (cleaned.startsWith("7") && cleaned.length === 11) {
    // 79050550020 -> 79050550020
    return cleaned
  } else if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    // 9050550020 -> 79050550020
    return "7" + cleaned
  } else if (cleaned.startsWith("+380") && cleaned.length === 13) {
    // +380668863317 -> 380668863317 (украинские номера)
    return cleaned.slice(1)
  } else if (cleaned.startsWith("380") && cleaned.length === 12) {
    // 380668863317 -> 380668863317 (украинские номера)
    return cleaned
  }

  console.warn(`Invalid phone format: "${phone}" (cleaned: "${cleaned}")`)
  return null
}*/}

export function validateExcelData(rows: ExcelRow[]): { valid: ExcelRow[]; errors: string[] } {
  const valid: ExcelRow[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (!row.phone) {
      errors.push(`Строка ${i + 2}: отсутствует номер телефона`)
      continue
    }

    if (!row.trip_identifier) {
      errors.push(`Строка ${i + 2}: отсутствует идентификатор рейса`)
      continue
    }

    if (!row.vehicle_number) {
      errors.push(`Строка ${i + 2}: отсутствует номер транспорта`)
      continue
    }

    if (!row.planned_loading_time) {
      errors.push(`Строка ${i + 2}: отсутствует время погрузки`)
      continue
    }

    if (!row.point_id) {
      errors.push(`Строка ${i + 2}: отсутствует ID пункта`)
      continue
    }

    if (!["P", "D"].includes(row.point_type)) {
      errors.push(`Строка ${i + 2}: неверный тип пункта "${row.point_type}" (должен быть P или D)`)
      continue
    }

    // Проверяем формат номера (поддерживаем российские и украинские)
    
    valid.push(row)
  }

  return { valid, errors }
}

export function groupTripsByPhone(rows: ExcelRow[]): TripData[] {
  const tripMap = new Map<string, TripData>()

  for (const row of rows) {
    const key = `${row.phone}_${row.trip_identifier}`

    if (!tripMap.has(key)) {
      tripMap.set(key, {
        phone: row.phone,
        trip_identifier: row.trip_identifier,
        vehicle_number: row.vehicle_number,
        planned_loading_time: row.planned_loading_time,
        driver_comment: row.driver_comment,
        loading_points: [],
        unloading_points: [],
      })
    }

    const tripData = tripMap.get(key)!

    if (row.point_type === "P") {
      tripData.loading_points.push({
        point_num: row.point_num,
        point_id: row.point_id,
      })
    } else if (row.point_type === "D") {
      tripData.unloading_points.push({
        point_num: row.point_num,
        point_id: row.point_id,
      })
    }
  }

  // Сортируем пункты по номеру
  for (const tripData of tripMap.values()) {
    tripData.loading_points.sort((a, b) => a.point_num - b.point_num)
    tripData.unloading_points.sort((a, b) => a.point_num - b.point_num)
  }

  return Array.from(tripMap.values())
}

// Функция для создания примера Excel файла с новой структурой
export function createExampleExcelFile(): ArrayBuffer {
  const data = [
    [
      "phone",
      "trip_identifier",
      "vehicle_number",
      "planned_loading_time",
      "point_type",
      "point_num",
      "point_id",
      "driver_comment",
    ],
    ["79050550020", "12345631", "В 123 ВВ 45", "20.06.2025 10:00", "P", 1, "8117", "тест"],
    ["79050550020", "12345631", "В 123 ВВ 45", "20.06.2025 10:00", "P", 2, "8123", "тест"],
    ["79050550020", "12345631", "В 123 ВВ 45", "20.06.2025 10:00", "D", 1, "0124", "тест"],
    ["79050550020", "12345631", "В 123 ВВ 45", "20.06.2025 10:00", "D", 2, "0029", "тест"],
    ["79161234567", "12345632", "А 456 АА 77", "21.06.2025 14:00", "P", 1, "8117", "срочно"],
    ["79161234567", "12345632", "А 456 АА 77", "21.06.2025 14:00", "D", 1, "0124", "срочно"],
    ["380668863317", "12345633", "УА 123 КВ", "22.06.2025 09:00", "P", 1, "8117", "украина"],
    ["380668863317", "12345633", "УА 123 КВ", "22.06.2025 09:00", "D", 1, "0124", "украина"],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Рейсы")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" })
}

// Алиас для обратной совместимости
export const parseExcelFile = parseExcelData
