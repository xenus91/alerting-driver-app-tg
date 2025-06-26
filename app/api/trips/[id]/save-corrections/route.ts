import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, corrections, deletedTrips = [] } = await request.json()

  try {
    console.log(`Saving corrections for trip ${tripId}, phone ${phone}`)
    console.log("Corrections data:", corrections)

    // Начинаем транзакцию
    await sql`BEGIN`

    // Сначала удаляем рейсы, которые были помечены для удаления
    if (deletedTrips.length > 0) {
      console.log(`Deleting trips: ${deletedTrips.join(", ")} for phone ${phone}`)

      for (const tripIdentifier of deletedTrips) {
        // Удаляем из trip_messages
        await sql`
          DELETE FROM trip_messages 
          WHERE trip_id = ${tripId} 
            AND phone = ${phone} 
            AND trip_identifier = ${tripIdentifier}
        `

        // Удаляем из trip_points
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND trip_identifier = ${tripIdentifier}
        `

        console.log(`Deleted trip ${tripIdentifier} for phone ${phone}`)
      }
    }

    try {
      // Группируем корректировки по original_trip_identifier для обновления
      const originalTripGroups = new Map()

      for (const correction of corrections) {
        const originalKey = correction.original_trip_identifier || correction.trip_identifier
        if (!originalTripGroups.has(originalKey)) {
          originalTripGroups.set(originalKey, {
            original_trip_identifier: originalKey,
            new_trip_identifier: correction.trip_identifier,
            vehicle_number: correction.vehicle_number,
            planned_loading_time: correction.planned_loading_time,
            driver_comment: correction.driver_comment,
            points: [],
            is_new_trip: !correction.original_trip_identifier, // Новый рейс если нет original
          })
        }

        if (correction.point_id) {
          originalTripGroups.get(originalKey).points.push({
            point_type: correction.point_type,
            point_num: correction.point_num,
            point_id: correction.point_id,
          })
        }
      }

      // Обрабатываем каждый рейс
      for (const [originalTripIdentifier, tripData] of originalTripGroups) {
        if (tripData.is_new_trip) {
          // Создаем новое сообщение для нового рейса
          await sql`
            INSERT INTO trip_messages (
              trip_id, phone, message, telegram_id, response_status,
              trip_identifier, vehicle_number, planned_loading_time, driver_comment
            )
            SELECT 
              ${tripId}, 
              ${phone}, 
              'Новый рейс', 
              telegram_id, 
              'pending',
              ${tripData.new_trip_identifier},
              ${tripData.vehicle_number},
              ${tripData.planned_loading_time},
              ${tripData.driver_comment || null}
            FROM users 
            WHERE phone = ${phone}
            LIMIT 1
          `
        } else {
          // Обновляем существующее сообщение
          await sql`
            UPDATE trip_messages 
            SET trip_identifier = ${tripData.new_trip_identifier},
                vehicle_number = ${tripData.vehicle_number},
                planned_loading_time = ${tripData.planned_loading_time},
                driver_comment = ${tripData.driver_comment || null}
            WHERE trip_id = ${tripId} 
              AND phone = ${phone} 
              AND trip_identifier = ${originalTripIdentifier}
          `
        }

        // Удаляем старые точки для этого рейса (используем original_trip_identifier)
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND trip_identifier = ${originalTripIdentifier}
        `

        // Добавляем новые точки с новым trip_identifier
        for (const point of tripData.points) {
          // Получаем ID точки из таблицы points
          const pointResult = await sql`
            SELECT id FROM points WHERE point_id = ${point.point_id}
          `

          if (pointResult.length > 0) {
            await sql`
              INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier)
              VALUES (${tripId}, ${pointResult[0].id}, ${point.point_type}, ${point.point_num}, ${tripData.new_trip_identifier})
            `
          }
        }
      }

      await sql`COMMIT`

      console.log(
        `Corrections saved successfully for ${originalTripGroups.size} trips, deleted ${deletedTrips.length} trips`,
      )

      return NextResponse.json({
        success: true,
        message: "Corrections saved successfully",
        updatedTrips: originalTripGroups.size,
        deletedTrips: deletedTrips.length,
      })
    } catch (error) {
      await sql`ROLLBACK`
      throw error
    }
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
