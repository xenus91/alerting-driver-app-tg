import { type NextRequest, NextResponse } from "next/server"
import { parseExcelFile } from "@/lib/excel"
import { getUsersWithVerificationByPhones, getAllPoints } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}`)

    // Парсим Excel файл
    const excelData = await parseExcelFile(file)
    console.log(`Parsed ${excelData.length} rows from Excel`)

    if (excelData.length === 0) {
      return NextResponse.json({ error: "Файл пуст или не содержит данных" }, { status: 400 })
    }

    // Валидируем и группируем данные
    const validationErrors: string[] = []
    const validRows: any[] = []
    const phoneSet = new Set<string>()

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i]
      const rowNum = i + 2 // +2 because Excel rows start from 1 and we skip header

      try {
        // Проверяем обязательные поля
        if (!row.phone || !row.trip_identifier || !row.vehicle_number) {
          validationErrors.push(`Строка ${rowNum}: отсутствуют обязательные поля`)
          continue
        }

        // Нормализуем телефон
        let normalizedPhone = String(row.phone).replace(/\D/g, "")
        if (normalizedPhone.startsWith("8") && normalizedPhone.length === 11) {
          normalizedPhone = "7" + normalizedPhone.slice(1)
        }

        if (normalizedPhone.length !== 11 || !normalizedPhone.startsWith("7")) {
          validationErrors.push(`Строка ${rowNum}: неверный формат телефона ${row.phone}`)
          continue
        }

        phoneSet.add(normalizedPhone)

        validRows.push({
          ...row,
          phone: normalizedPhone,
          rowNum,
        })
      } catch (error) {
        validationErrors.push(`Строка ${rowNum}: ошибка обработки - ${error}`)
      }
    }

    console.log(`Validated ${validRows.length} rows, found ${validationErrors.length} errors`)

    // Получаем информацию о пользователях и их верификации
    const phones = Array.from(phoneSet)
    const users = await getUsersWithVerificationByPhones(phones)
    console.log(`Found ${users.length} users in database`)

    // Создаем карты для быстрого поиска
    const usersMap = new Map()
    for (const user of users) {
      usersMap.set(user.phone, user)
    }

    // Получаем все пункты из базы данных
    const allPoints = await getAllPoints()
    const pointsMap = new Map()
    for (const point of allPoints) {
      pointsMap.set(point.point_id, point)
    }

    // Анализируем пользователей и пункты
    const notFoundPhones = new Set<string>()
    const notVerifiedPhones = new Set<string>()
    const notFoundPointIds = new Set<string>()

    for (const phone of phones) {
      const user = usersMap.get(phone)
      if (!user) {
        notFoundPhones.add(phone)
      } else if (user.verified === false) {
        notVerifiedPhones.add(phone)
      }
    }

    // Проверяем пункты
    for (const row of validRows) {
      const loadingPoints = [row.loading_point_1, row.loading_point_2, row.loading_point_3].filter(Boolean)
      const unloadingPoints = [row.unloading_point_1, row.unloading_point_2, row.unloading_point_3].filter(Boolean)

      for (const pointId of [...loadingPoints, ...unloadingPoints]) {
        if (!pointsMap.has(pointId)) {
          notFoundPointIds.add(pointId)
        }
      }
    }

    // Группируем данные по телефону и рейсу
    const tripData: any[] = []
    const processedTrips = new Set<string>()

    for (const row of validRows) {
      const user = usersMap.get(row.phone)

      // Пропускаем неверифицированных пользователей и не найденных
      if (!user || user.verified === false) {
        continue
      }

      const tripKey = `${row.phone}_${row.trip_identifier}`
      if (processedTrips.has(tripKey)) {
        continue
      }
      processedTrips.add(tripKey)

      // Собираем пункты погрузки
      const loading_points = []
      const loadingPointIds = [row.loading_point_1, row.loading_point_2, row.loading_point_3].filter(Boolean)
      for (let i = 0; i < loadingPointIds.length; i++) {
        const pointId = loadingPointIds[i]
        if (pointsMap.has(pointId)) {
          loading_points.push({
            point_num: i + 1,
            point_id: pointId,
          })
        }
      }

      // Собираем пункты разгрузки
      const unloading_points = []
      const unloadingPointIds = [row.unloading_point_1, row.unloading_point_2, row.unloading_point_3].filter(Boolean)
      for (let i = 0; i < unloadingPointIds.length; i++) {
        const pointId = unloadingPointIds[i]
        if (pointsMap.has(pointId)) {
          unloading_points.push({
            point_num: i + 1,
            point_id: pointId,
          })
        }
      }

      // Добавляем только если есть пункты и пользователь верифицирован
      if (loading_points.length > 0 || unloading_points.length > 0) {
        tripData.push({
          phone: row.phone,
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment,
          loading_points,
          unloading_points,
        })
      }
    }

    console.log(`Created ${tripData.length} ready trips (verified users only)`)

    return NextResponse.json({
      success: true,
      totalRows: excelData.length,
      validRows: validRows.length,
      readyToSend: tripData.length,
      notFoundPhones: notFoundPhones.size,
      notVerifiedPhones: notVerifiedPhones.size,
      notFoundPoints: notFoundPointIds.size,
      notFoundPhonesList: Array.from(notFoundPhones),
      notVerifiedPhonesList: Array.from(notVerifiedPhones),
      readyTrips: tripData.map((trip) => ({
        phone: trip.phone,
        trip_identifier: trip.trip_identifier,
        vehicle_number: trip.vehicle_number,
      })),
      tripData: tripData, // Только верифицированные пользователи
      errors: validationErrors,
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
