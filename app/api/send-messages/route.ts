import { sql } from "@vercel/postgres"
import { NextResponse } from "next/server"
import { z } from "zod"

import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

const schema = z.object({
  phone: z.string(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = schema.parse(body)

    // Получаем пользователя по номеру телефона
    const users = await sql`SELECT * FROM users WHERE phone = ${phone}`
    const user = users.rows[0]

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Получаем все поездки пользователя, у которых status = 'created'
    const trips = await sql`SELECT * FROM trips WHERE user_id = ${user.id} AND status = 'created'`
    const phoneTrips = trips.rows

    if (!phoneTrips || phoneTrips.length === 0) {
      return NextResponse.json({ message: "No created trips found for this user" }, { status: 200 })
    }

    // Создаем запись в messages
    const messageRecordResult = await sql`
      INSERT INTO messages (user_id, type, status)
      VALUES (${user.id}, 'trip_offer', 'created')
      RETURNING id
    `
    const messageRecord = messageRecordResult.rows[0]

    // Получаем данные о пунктах для каждого рейса отдельно
    const tripsWithPoints = await Promise.all(
      phoneTrips.map(async (trip) => {
        // Получаем пункты погрузки для конкретного рейса
        const loadingPointsResult = await sql`
          SELECT DISTINCT p.point_name, p.door_open_1, p.door_open_2, p.door_open_3, tp.point_id
          FROM trip_points tp
          JOIN points p ON tp.point_id = p.point_id
          WHERE tp.trip_identifier = ${trip.trip_identifier} 
          AND tp.point_type = 'P'
          ORDER BY tp.point_num
        `

        // Получаем пункты разгрузки для конкретного рейса
        const unloadingPointsResult = await sql`
          SELECT DISTINCT p.point_name, p.door_open_1, p.door_open_2, p.door_open_3, tp.point_id
          FROM trip_points tp
          JOIN points p ON tp.point_id = p.point_id
          WHERE tp.trip_identifier = ${trip.trip_identifier} 
          AND tp.point_type = 'D'
          ORDER BY tp.point_num
        `

        return {
          ...trip,
          loading_points: loadingPointsResult.map((point: any) => ({
            point_id: point.point_id,
            point_name: point.point_name,
            door_open_1: point.door_open_1,
            door_open_2: point.door_open_2,
            door_open_3: point.door_open_3,
          })),
          unloading_points: unloadingPointsResult.map((point: any) => ({
            point_id: point.point_id,
            point_name: point.point_name,
            door_open_1: point.door_open_1,
            door_open_2: point.door_open_2,
            door_open_3: point.door_open_3,
          })),
        }
      }),
    )

    // Отправляем сообщение с правильными данными
    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_chat_id,
      tripsWithPoints,
      user.first_name || "Водитель",
      messageRecord.id,
    )

    // Обновляем статус сообщения
    await sql`
      UPDATE messages
      SET status = 'sent'
      WHERE id = ${messageRecord.id}
    `

    return NextResponse.json({ message: "Messages sent successfully", telegramResult }, { status: 200 })
  } catch (error: any) {
    console.error("Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
