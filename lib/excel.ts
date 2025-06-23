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
          const normalizedPhone = normalizePhone(phone)
          if (normalizedPhone) {
            rows.push({
              phone: normalizedPhone,
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
  }

  console.warn(`Invalid phone format: "${phone}" (cleaned: "${cleaned}")`)
  return null
}

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

    // Проверяем формат номера (БЕЗ знака +)
    if (!row.phone.match(/^7\d{10}$/)) {
      errors.push(`Строка ${i + 2}: неверный формат номера телефона "${row.phone}" (ожидается 7XXXXXXXXXX)`)
      continue
    }

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

// Новая функция для группировки по телефону (без разделения по рейсам)
export function groupTripsByPhoneOnly(rows: ExcelRow[]): Map<string, TripData[]> {
  const phoneMap = new Map<string, TripData[]>()

  // Сначала группируем по телефону и рейсу
  const tripsByPhoneAndTrip = groupTripsByPhone(rows)

  // Затем группируем только по телефону
  for (const tripData of tripsByPhoneAndTrip) {
    if (!phoneMap.has(tripData.phone)) {
      phoneMap.set(tripData.phone, [])
    }
    phoneMap.get(tripData.phone)!.push(tripData)
  }

  return phoneMap
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
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Рейсы")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" })
}
