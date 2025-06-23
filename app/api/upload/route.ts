import { type NextRequest, NextResponse } from "next/server"
import { parseExcelData, validateExcelData, groupTripsByPhone, createExampleExcelFile } from "@/lib/excel"
import {
  createTrip,
  createTripMessage,
  createTripPoint,
  getUserByPhone,
  getAllPoints,
  type Point,
} from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 })
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

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Ошибки валидации данных",
          details: errors,
          validRows: validRows.length,
          totalRows: rawRows.length,
        },
        { status: 400 },
      )
    }

    if (validRows.length === 0) {
      return NextResponse.json({ error: "Нет валидных данных для обработки" }, { status: 400 })
    }

    // Группируем по телефонам и рейсам
    const groupedTrips = groupTripsByPhone(validRows)
    console.log(`Grouped into ${groupedTrips.length} trips`)

    // Получаем все доступные пункты из базы данных
    const allPoints = await getAllPoints()
    console.log(`Found ${allPoints.length} points in database`)

    // Создаем карту пунктов для быстрого поиска
    const pointsMap = new Map<string, Point>()
    for (const point of allPoints) {
      pointsMap.set(point.point_id, point)
    }

    // Создаем основной trip
    const mainTrip = await createTrip()
    console.log(`Created main trip with ID: ${mainTrip.id}`)

    const results = {
      tripId: mainTrip.id,
      processed: 0,
      phoneNotFound: 0,
      pointNotFound: 0,
      details: [] as any[],
    }

    // Обрабатываем каждый сгруппированный рейс
    for (const tripData of groupedTrips) {
      try {
        // Ищем пользователя по номеру телефона
        const user = await getUserByPhone(tripData.phone)
        if (!user) {
          console.log(`User not found for phone: ${tripData.phone}`)
          results.phoneNotFound++
          continue
        }

        console.log(`Processing trip for user: ${user.first_name || user.name}`)

        // Создаем пункты для этого рейса
        for (const loadingPoint of tripData.loading_points) {
          const point = pointsMap.get(loadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${loadingPoint.point_id}`)
            results.pointNotFound++
            continue
          }

          await createTripPoint(
            mainTrip.id,
            loadingPoint.point_id,
            "P",
            loadingPoint.point_num,
            tripData.trip_identifier, // Передаем trip_identifier
          )
        }

        for (const unloadingPoint of tripData.unloading_points) {
          const point = pointsMap.get(unloadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${unloadingPoint.point_id}`)
            results.pointNotFound++
            continue
          }

          await createTripPoint(
            mainTrip.id,
            unloadingPoint.point_id,
            "D",
            unloadingPoint.point_num,
            tripData.trip_identifier, // Передаем trip_identifier
          )
        }

        // Создаем сообщение для этого рейса
        await createTripMessage(
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

        results.processed++
        console.log(`Processed trip for user: ${user.first_name || user.name} (${tripData.phone})`)
      } catch (error) {
        console.error(`Error processing trip for phone ${tripData.phone}:`, error)
        results.details.push({
          phone: tripData.phone,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    console.log(
      `Processing complete. Ready to send: ${results.processed}, Not found phones: ${results.phoneNotFound}, Not found points: ${results.pointNotFound}`,
    )

    return NextResponse.json({
      success: true,
      tripId: mainTrip.id,
      results: results,
      summary: {
        totalRows: rawRows.length,
        validRows: validRows.length,
        groupedTrips: groupedTrips.length,
        processed: results.processed,
        phoneNotFound: results.phoneNotFound,
        pointNotFound: results.pointNotFound,
      },
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

export async function GET() {
  try {
    // Создаем пример Excel файла
    const exampleBuffer = createExampleExcelFile()

    return new NextResponse(exampleBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="example-trips.xlsx"',
      },
    })
  } catch (error) {
    console.error("Error creating example file:", error)
    return NextResponse.json({ error: "Ошибка при создании примера файла" }, { status: 500 })
  }
}
