import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const messageId = Number.parseInt(params.id)
    const body = await request.json()
    const { isCorrection = false } = body

    console.log(`=== DEBUG: resend-combined for messageId: ${messageId}, isCorrection: ${isCorrection} ===`)

    // Получаем информацию о сообщении
    const messageResult = await query`
      SELECT trip_id, phone, telegram_id FROM trip_messages WHERE id = ${messageId}
    `

    if (messageResult.length === 0) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 })
    }

    const { trip_id: tripId, phone, telegram_id } = messageResult[0]

    console.log(`DEBUG: Found message - tripId: ${tripId}, phone: ${phone}, telegram_id: ${telegram_id}`)

    // Получаем все сообщения для этого телефона в данном рейсе
    const result = await query`
      SELECT DISTINCT
        tm.phone,
        tm.telegram_id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        u.first_name,
        u.full_name
      FROM trip_messages tm
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = ${tripId} AND tm.phone = ${phone} AND tm.telegram_id IS NOT NULL
      ORDER BY tm.planned_loading_time
    `

    console.log(`DEBUG: Found ${result.length} trip messages for phone ${phone}`)

    const groupedData = new Map()

    for (const row of result) {
      if (!groupedData.has(row.phone)) {
        groupedData.set(row.phone, {
          phone: row.phone,
          telegram_id: row.telegram_id,
          first_name: row.first_name,
          full_name: row.full_name,
          trips: new Map(),
        })
      }

      const phoneGroup = groupedData.get(row.phone)

      if (row.trip_identifier && !phoneGroup.trips.has(row.trip_identifier)) {
        console.log(`DEBUG: Getting points for trip_identifier: ${row.trip_identifier}`)

        // Получаем точки для этого рейса, отсортированные только по point_num
        const tripPointsResult = await query`
          SELECT DISTINCT
            tp.point_type,
            tp.point_num,
            p.point_id,
            p.point_name,
            p.door_open_1,
            p.door_open_2,
            p.door_open_3,
            p.latitude,
            p.longitude,
            p.adress
          FROM trip_points tp
          JOIN points p ON tp.point_id = p.id
          WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${row.trip_identifier}
          ORDER BY tp.point_num
        `

        console.log(`DEBUG: Found ${tripPointsResult.length} points for trip ${row.trip_identifier}`)

        // Сначала сортируем все точки по point_num
        const sortedPoints = tripPointsResult.sort((a, b) => a.point_num - b.point_num)

        const loading_points = []
        const unloading_points = []

        // Затем разделяем на типы, сохраняя порядок по point_num
        for (const point of sortedPoints) {
          const pointInfo = {
            point_id: point.point_id,
            point_name: point.point_name,
            point_num: point.point_num,
            door_open_1: point.door_open_1,
            door_open_2: point.door_open_2,
            door_open_3: point.door_open_3,
            latitude: point.latitude,
            longitude: point.longitude,
            adress: point.adress,
          }

          if (point.point_type === "P") {
            loading_points.push(pointInfo)
          } else if (point.point_type === "D") {
            unloading_points.push(pointInfo)
          }
        }

        phoneGroup.trips.set(row.trip_identifier, {
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment,
          loading_points: loading_points,
          unloading_points: unloading_points,
        })

        console.log(
          `DEBUG: Created trip ${row.trip_identifier} with ${loading_points.length} loading and ${unloading_points.length} unloading points`,
        )
      }
    }

    console.log(`DEBUG: Final grouped data has ${groupedData.size} phone groups`)

    // Отправляем сообщения
    const sendResults = await sendMultipleTripMessageWithButtons(groupedData, true, isCorrection)

    console.log(`DEBUG: Send results:`, sendResults)

    return NextResponse.json({
      success: true,
      results: sendResults,
    })
  } catch (error) {
    console.error("Error in resend-combined:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend messages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
