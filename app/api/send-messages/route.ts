import { NextResponse } from "next/server"
import {
  createTrip,
  createTripMessage,
  createTripPoint,
  updateTripMessage,
  updateMessageStatus,
  getUserByPhone,
} from "@/lib/database"
import { formatTripMessage } from "@/lib/telegram"
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

    console.log(`Send messages request from user: ${currentUser.name} (carpark: ${currentUser.carpark})`)

    const { tripData } = await request.json()

    if (!tripData || !Array.isArray(tripData)) {
      return NextResponse.json({
        success: false,
        error: "Неверные данные поездки",
      })
    }

    console.log(`Processing ${tripData.length} trips with carpark: ${currentUser.carpark}`)

    // Создаем новую рассылку с carpark пользователя
    const trip = await createTrip(currentUser.carpark)
    console.log(`Created trip ${trip.id} with carpark: ${currentUser.carpark}`)

    const results = {
      total: tripData.length,
      sent: 0,
      errors: 0,
      details: [] as Array<{
        phone: string
        status: string
        error?: string
      }>,
    }

    // Обрабатываем каждую поездку
    for (const data of tripData) {
      try {
        console.log(`Processing trip for phone: ${data.phone}`)

        // Получаем пользователя по телефону
        const user = await getUserByPhone(data.phone)
        if (!user) {
          console.warn(`User not found for phone: ${data.phone}`)
          results.errors++
          results.details.push({
            phone: data.phone,
            status: "error",
            error: "Пользователь не найден",
          })
          continue
        }

        if (!user.verified) {
          console.warn(`User not verified for phone: ${data.phone}`)
          results.errors++
          results.details.push({
            phone: data.phone,
            status: "error",
            error: "Пользователь не верифицирован",
          })
          continue
        }

        // Создаем сообщение для поездки
        const tripMessage = await createTripMessage(trip.id, data.phone, "", user.telegram_id, {
          trip_identifier: data.trip_identifier,
          vehicle_number: data.vehicle_number,
          planned_loading_time: data.planned_loading_time,
          driver_comment: data.driver_comment,
        })

        console.log(`Created trip message ${tripMessage.id} for phone: ${data.phone}`)

        // Создаем точки погрузки
        for (const point of data.loading_points) {
          await createTripPoint(trip.id, point.point_id, "P", point.point_num, data.trip_identifier)
          console.log(`Created loading point: ${point.point_id}`)
        }

        // Создаем точки разгрузки
        for (const point of data.unloading_points) {
          await createTripPoint(trip.id, point.point_id, "D", point.point_num, data.trip_identifier)
          console.log(`Created unloading point: ${point.point_id}`)
        }

        // Форматируем сообщение
        const formattedMessage = formatTripMessage(data, tripMessage.id)
        await updateTripMessage(tripMessage.id, formattedMessage)

        console.log(`Updated trip message ${tripMessage.id} with formatted content`)

        // Помечаем как готовое к отправке
        await updateMessageStatus(tripMessage.id, "pending")

        results.sent++
        results.details.push({
          phone: data.phone,
          status: "created",
        })

        console.log(`Successfully processed trip for phone: ${data.phone}`)
      } catch (error) {
        console.error(`Error processing trip for phone ${data.phone}:`, error)
        results.errors++
        results.details.push({
          phone: data.phone,
          status: "error",
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        })
      }
    }

    console.log(`Send messages completed:`, {
      tripId: trip.id,
      carpark: currentUser.carpark,
      total: results.total,
      sent: results.sent,
      errors: results.errors,
    })

    return NextResponse.json({
      success: true,
      tripId: trip.id,
      results,
    })
  } catch (error) {
    console.error("Error sending messages:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при отправке сообщений",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
