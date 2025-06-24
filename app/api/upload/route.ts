import { type NextRequest, NextResponse } from "next/server"
import { parseExcelData, validateExcelData, groupTripsByPhone } from "@/lib/excel"
import { getUserByPhone, getAllPoints, type Point } from "@/lib/database"

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

    const results = {
      processed: 0,
      phoneNotFound: 0,
      phoneNotVerified: 0,
      pointNotFound: 0,
      details: [] as any[],
      notFoundPhones: [] as string[],
      notVerifiedPhones: [] as string[],
    }

    // Проверяем каждый сгруппированный рейс БЕЗ создания trip
    for (const tripData of groupedTrips) {
      try {
        // Ищем пользователя по номеру телефона
        const user = await getUserByPhone(tripData.phone)
        if (!user) {
          console.log(`User not found for phone: ${tripData.phone}`)
          results.phoneNotFound++
          results.notFoundPhones.push(tripData.phone)
          continue
        }

        // Проверяем верификацию пользователя
        if (!user.verified) {
          console.log(`User not verified for phone: ${tripData.phone}`)
          results.phoneNotVerified++
          results.notVerifiedPhones.push(tripData.phone)
          continue
        }

        console.log(`Processing trip for user: ${user.first_name || user.name}`)

        // Проверяем наличие всех пунктов
        let allPointsExist = true
        for (const loadingPoint of tripData.loading_points) {
          const point = pointsMap.get(loadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${loadingPoint.point_id}`)
            results.pointNotFound++
            allPointsExist = false
          }
        }

        for (const unloadingPoint of tripData.unloading_points) {
          const point = pointsMap.get(unloadingPoint.point_id)
          if (!point) {
            console.warn(`Point not found: ${unloadingPoint.point_id}`)
            results.pointNotFound++
            allPointsExist = false
          }
        }

        if (allPointsExist) {
          results.processed++
          console.log(`Validated trip for user: ${user.first_name || user.name} (${tripData.phone})`)
        }
      } catch (error) {
        console.error(`Error processing trip for phone ${tripData.phone}:`, error)
        results.details.push({
          phone: tripData.phone,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    console.log(
      `Processing complete. Ready to send: ${results.processed}, Not found phones: ${results.phoneNotFound}, Not verified phones: ${results.phoneNotVerified}, Not found points: ${results.pointNotFound}`,
    )

    return NextResponse.json({
      success: true,
      // НЕ создаем campaign здесь, только возвращаем данные для валидации
      totalRows: rawRows.length,
      validRows: validRows.length,
      readyToSend: results.processed,
      notFoundPhones: results.phoneNotFound,
      notVerifiedPhones: results.phoneNotVerified,
      notFoundPoints: results.pointNotFound,
      notFoundPhonesList: results.notFoundPhones,
      notVerifiedPhonesList: results.notVerifiedPhones,
      readyTrips: groupedTrips.slice(0, results.processed).map((trip) => ({
        phone: trip.phone,
        trip_identifier: trip.trip_identifier,
        vehicle_number: trip.vehicle_number,
      })),
      // Сохраняем данные для последующей отправки
      tripData: groupedTrips,
      errors: errors,
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
    const { createExampleExcelFile } = await import("@/lib/excel")
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
