import { NextResponse } from "next/server"
import { parseExcelData, validateExcelData, groupTripsByPhone } from "@/lib/excel"
import { getUsersWithVerificationByPhones, getAllPoints } from "@/lib/database"
import { cookies } from "next/headers"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export const dynamic = "force-dynamic"

// Функция для получения текущего пользователя
async function getCurrentUser() {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get("session_token")

  if (!sessionToken) {
    return null
  }

  const result = await sql`
    SELECT u.*, s.expires_at
    FROM users u
    JOIN user_sessions s ON u.id = s.user_id
    WHERE s.session_token = ${sessionToken.value}
    AND s.expires_at > NOW()
    LIMIT 1
  `

  return result[0] || null
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 })
    }

    console.log(`Upload request from user: ${currentUser.name} (carpark: ${currentUser.carpark})`)

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: "Файл не найден",
      })
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}`)

    // Читаем файл
    const buffer = await file.arrayBuffer()

    // Парсим Excel данные
    const excelRows = parseExcelData(buffer)
    console.log(`Parsed ${excelRows.length} rows from Excel`)

    // Валидируем данные
    const { valid: validRows, errors } = validateExcelData(excelRows)
    console.log(`Valid rows: ${validRows.length}, Errors: ${errors.length}`)

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Нет валидных данных для обработки",
        errors,
      })
    }

    // Группируем по телефонам
    const tripData = groupTripsByPhone(validRows)
    console.log(`Grouped into ${tripData.length} trips`)

    // Получаем уникальные номера телефонов
    const phones = [...new Set(tripData.map((trip) => trip.phone))]
    console.log(`Unique phones: ${phones.length}`)

    // Проверяем пользователей в базе
    const usersInDb = await getUsersWithVerificationByPhones(phones)
    console.log(`Found ${usersInDb.length} users in database`)

    // Получаем все точки для проверки
    const allPoints = await getAllPoints()
    const pointIds = new Set(allPoints.map((p) => p.point_id))
    console.log(`Available points: ${pointIds.size}`)

    // Анализируем данные
    const foundPhones = new Set(usersInDb.map((u) => u.phone))
    const verifiedPhones = new Set(usersInDb.filter((u) => u.verified).map((u) => u.phone))

    const notFoundPhones = phones.filter((phone) => !foundPhones.has(phone))
    const notVerifiedPhones = phones.filter((phone) => foundPhones.has(phone) && !verifiedPhones.has(phone))

    console.log(`Not found phones: ${notFoundPhones.length}`)
    console.log(`Not verified phones: ${notVerifiedPhones.length}`)

    // Проверяем точки
    const allTripPoints = tripData.flatMap((trip) => [
      ...trip.loading_points.map((p) => p.point_id),
      ...trip.unloading_points.map((p) => p.point_id),
    ])
    const uniqueTripPoints = [...new Set(allTripPoints)]
    const notFoundPoints = uniqueTripPoints.filter((pointId) => !pointIds.has(pointId))

    console.log(`Trip points: ${uniqueTripPoints.length}, Not found: ${notFoundPoints.length}`)

    // Готовые к отправке поездки (только верифицированные пользователи с существующими точками)
    const readyTrips = tripData.filter((trip) => {
      const phoneVerified = verifiedPhones.has(trip.phone)
      const allPointsExist =
        trip.loading_points.every((p) => pointIds.has(p.point_id)) &&
        trip.unloading_points.every((p) => pointIds.has(p.point_id))
      return phoneVerified && allPointsExist
    })

    console.log(`Ready trips: ${readyTrips.length}`)

    // Подготавливаем результат с carpark пользователя
    const result = {
      success: true,
      totalRows: excelRows.length,
      validRows: validRows.length,
      readyToSend: readyTrips.length,
      notFoundPhones: notFoundPhones.length,
      notVerifiedPhones: notVerifiedPhones.length,
      notFoundPoints: notFoundPoints.length,
      notFoundPhonesList: notFoundPhones,
      notVerifiedPhonesList: notVerifiedPhones,
      readyTrips: readyTrips.map((trip) => ({
        phone: trip.phone,
        trip_identifier: trip.trip_identifier,
        vehicle_number: trip.vehicle_number,
      })),
      tripData: readyTrips,
      errors: errors.length > 0 ? errors : undefined,
      carpark: currentUser.carpark, // Добавляем carpark в результат
    }

    console.log(`Upload result:`, {
      totalRows: result.totalRows,
      validRows: result.validRows,
      readyToSend: result.readyToSend,
      carpark: result.carpark,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error processing upload:", error)
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
