import { type NextRequest, NextResponse } from "next/server"
import { parseExcelData, validateExcelData, groupTripsByPhone } from "@/lib/excel"
import { createTrip, createTripMessage, createTripPoint, getUserByPhone, getAllPoints } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}`)

    // Читаем файл
    const buffer = await file.arrayBuffer()

    // Парсим Excel данные
    const rawRows = parseExcelData(buffer)
    console.log(`Parsed ${rawRows.length} raw rows`)

    // Валидируем данные
    const { valid: validRows, errors } = validateExcelData(rawRows)
    console.log(`Valid rows: ${validRows.length}, Errors: ${errors.length}`)

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Нет валидных данных для обработки",
          errors: errors,
        },
        { status: 400 },
      )
    }

    // Группируем по рейсам
    const trips = groupTripsByPhone(validRows)
    console.log(`Grouped into ${trips.length} trips`)

    // Получаем все пункты из базы для проверки
    const allPoints = await getAllPoints()
    const pointsMap = new Map(allPoints.map((p) => [p.point_id, p]))
    console.log(`Found ${allPoints.length} points in database`)

    // Проверяем пользователей и пункты
    const notFoundPhones: string[] = []
    const unverifiedPhones: string[] = [] // <-- НОВЫЙ МАССИВ
    const notFoundPoints: string[] = []
    const readyTrips: any[] = []
    let readyToSend = 0

    // Создаем основной рейс для группировки
    const mainTrip = await createTrip()
    console.log(`Created main trip with ID: ${mainTrip.id}`)

    for (const tripData of trips) {
      try {
        const user = await getUserByPhone(tripData.phone)
        if (!user) {
          console.log(`User not found for phone: ${tripData.phone}`)
          if (!notFoundPhones.includes(tripData.phone)) {
            notFoundPhones.push(tripData.phone)
          }
          continue
        }

        // ПРОВЕРЯЕМ ВЕРИФИКАЦИЮ <-- НОВАЯ ПРОВЕРКА
        if (user.verified !== true) {
          console.log(`User not verified for phone: ${tripData.phone}`)
          if (!unverifiedPhones.includes(tripData.phone)) {
            unverifiedPhones.push(tripData.phone)
          }
          continue
        }

        // Проверяем все пункты для этого рейса
        const allPointsExist = [...tripData.loading_points, ...tripData.unloading_points].every((point) => {
          const exists = pointsMap.has(point.point_id)
          if (!exists && !notFoundPoints.includes(point.point_id)) {
            notFoundPoints.push(point.point_id)
          }
          return exists
        })

        if (!allPointsExist) {
          console.log(`Some points not found for trip ${tripData.trip_identifier}`)
          continue
        }

        // Если все проверки прошли - создаем данные для рейса
        console.log(`Processing trip for user: ${user.first_name || user.name}`)

        // Создаем связи с пунктами погрузки
        for (const loadingPoint of tripData.loading_points) {
          await createTripPoint(mainTrip.id, loadingPoint.point_id, "P", loadingPoint.point_num)
        }

        // Создаем связи с пунктами разгрузки
        for (const unloadingPoint of tripData.unloading_points) {
          await createTripPoint(mainTrip.id, unloadingPoint.point_id, "D", unloadingPoint.point_num)
        }

        // Создаем сообщение для рейса
        const message = await createTripMessage(
          mainTrip.id,
          tripData.phone,
          "Автоматически сгенерированное сообщение о рейсе",
          user.telegram_id,
          {
            trip_identifier: tripData.trip_identifier,
            vehicle_number: tripData.vehicle_number,
            planned_loading_time: tripData.planned_loading_time,
            driver_comment: tripData.driver_comment,
          },
        )

        readyTrips.push({
          phone: tripData.phone,
          user_name: user.first_name || user.name,
          trip_identifier: tripData.trip_identifier,
          message_id: message.id,
        })

        readyToSend++
        console.log(`Processed trip for user: ${user.first_name || user.name} (${tripData.phone})`)
      } catch (error) {
        console.error(`Error processing trip for phone ${tripData.phone}:`, error)
        errors.push(
          `Ошибка обработки рейса для номера ${tripData.phone}: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
        )
      }
    }

    console.log(
      `Processing complete. Ready to send: ${readyToSend}, Not found phones: ${notFoundPhones.length}, Not found points: ${notFoundPoints.length}`,
    )

    return NextResponse.json({
      success: true,
      campaign: {
        id: mainTrip.id,
        name: `Рейсы ${new Date().toLocaleDateString("ru-RU")}`,
        created_at: mainTrip.created_at,
      },
      totalRows: rawRows.length,
      validRows: validRows.length,
      readyToSend: readyToSend,
      notFoundPhones: notFoundPhones,
      unverifiedPhones: unverifiedPhones, // <-- ДОБАВЛЯЕМ В ОТВЕТ
      notFoundPoints: notFoundPoints,
      readyTrips: readyTrips,
      errors: errors,
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
