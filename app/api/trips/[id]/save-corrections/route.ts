import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)
    const body = await request.json()
    const { corrections, deletedTrips } = body

    console.log(`=== DEBUG: save-corrections for tripId: ${tripId} ===`)
    console.log(`Corrections:`, corrections)
    console.log(`Deleted trips:`, deletedTrips)

    // Обрабатываем удаленные рейсы
    if (deletedTrips && deletedTrips.length > 0) {
      for (const deletedTrip of deletedTrips) {
        console.log(`DEBUG: Deleting trip ${deletedTrip.trip_identifier} for phone ${deletedTrip.phone}`)

        // Удаляем сообщения для этого рейса
        await query`
          DELETE FROM trip_messages 
          WHERE trip_id = ${tripId} 
          AND phone = ${deletedTrip.phone} 
          AND trip_identifier = ${deletedTrip.trip_identifier}
        `

        // Удаляем точки для этого рейса
        await query`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
          AND trip_identifier = ${deletedTrip.trip_identifier}
        `
      }
    }

    // Обрабатываем корректировки
    if (corrections && corrections.length > 0) {
      // Группируем корректировки по original_trip_identifier и phone
      const groupedCorrections = new Map()

      for (const correction of corrections) {
        const key = `${correction.phone}_${correction.original_trip_identifier}`
        if (!groupedCorrections.has(key)) {
          groupedCorrections.set(key, {
            phone: correction.phone,
            driver_phone: correction.driver_phone,
            original_trip_identifier: correction.original_trip_identifier,
            new_trip_identifier: correction.trip_identifier,
            vehicle_number: correction.vehicle_number,
            planned_loading_time: correction.planned_loading_time,
            driver_comment: correction.driver_comment,
            message_id: correction.message_id,
            points: [],
          })
        }

        groupedCorrections.get(key).points.push({
          point_type: correction.point_type,
          point_num: correction.point_num,
          point_id: correction.point_id,
          point_name: correction.point_name,
        })
      }

      console.log(`DEBUG: Processing ${groupedCorrections.size} correction groups`)

      // Обрабатываем каждую группу корректировок
      for (const [key, group] of groupedCorrections) {
        console.log(`DEBUG: Processing correction group: ${key}`)

        // Обновляем trip_messages
        await query`
          UPDATE trip_messages 
          SET trip_identifier = ${group.new_trip_identifier},
              vehicle_number = ${group.vehicle_number},
              planned_loading_time = ${group.planned_loading_time},
              driver_comment = ${group.driver_comment}
          WHERE trip_id = ${tripId} 
          AND phone = ${group.phone} 
          AND trip_identifier = ${group.original_trip_identifier}
        `

        // Удаляем старые точки для этого рейса
        await query`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
          AND trip_identifier = ${group.original_trip_identifier}
        `

        // Добавляем новые точки
        for (const point of group.points) {
          // Получаем ID точки из таблицы points
          const pointResult = await query`
            SELECT id FROM points WHERE point_id = ${point.point_id}
          `

          if (pointResult.length > 0) {
            await query`
              INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier, driver_phone)
              VALUES (${tripId}, ${pointResult[0].id}, ${point.point_type}, ${point.point_num}, ${group.new_trip_identifier}, ${group.driver_phone})
            `
          }
        }
      }
    }

    // Получаем обновленные данные для отправки сообщений
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
      WHERE tm.trip_id = ${tripId} AND tm.status = 'pending' AND tm.telegram_id IS NOT NULL
      ORDER BY tm.planned_loading_time
    `

    console.log(`DEBUG: Found ${result.length} messages to update`)

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
      }
    }

    // Отправляем обновленные сообщения
    if (groupedData.size > 0) {
      console.log(`DEBUG: Sending corrected messages to ${groupedData.size} phones`)
      const sendResults = await sendMultipleTripMessageWithButtons(groupedData, false, true)
      console.log(`DEBUG: Send results:`, sendResults)
    }

    return NextResponse.json({
      success: true,
      message: "Corrections saved and messages sent successfully",
    })
  } catch (error) {
    console.error("Error saving corrections:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save corrections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
