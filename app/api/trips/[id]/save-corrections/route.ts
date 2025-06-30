import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, corrections, deletedTrips = [] } = await request.json()

  try {
    console.log(`Saving corrections for trip ${tripId}, phone ${phone}`)
    console.log("Corrections data:", corrections)
    console.log("Deleted trips:", deletedTrips)

    // Начинаем транзакцию
    await sql`BEGIN`

    // 1. Помечаем удаленные рейсы вместо физического удаления
    if (deletedTrips.length > 0) {
      console.log(`Marking trips as deleted: ${deletedTrips.join(", ")}`)
      
      // Обновляем статус в trip_messages
      await sql`
        UPDATE trip_messages 
        SET status = 'deleted'
        WHERE trip_id = ${tripId} 
          AND phone = ${phone} 
          AND trip_identifier = ANY(${deletedTrips})
      `
      
      console.log(`Marked ${deletedTrips.length} trips as deleted in trip_messages`)
    }

    try {
      // 2. Группируем корректировки по original_trip_identifier
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
            is_new_trip: !correction.original_trip_identifier,
            is_restored: correction.is_restored || false // Флаг восстановления
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

      // 3. Обрабатываем каждый рейс
      for (const [originalTripIdentifier, tripData] of originalTripGroups) {
        if (tripData.is_new_trip) {
          // Создаем новый рейс
          console.log(`Creating new trip: ${tripData.new_trip_identifier}`)
          
          await sql`
            INSERT INTO trip_messages (
              trip_id, phone, message, telegram_id, status, response_status,
              trip_identifier, vehicle_number, planned_loading_time, driver_comment,
              sent_at
            )
            SELECT 
              ${tripId}, 
              ${phone}, 
              'Новый рейс (добавлен при корректировке)', 
              telegram_id, 
              'sent',
              'pending',
              ${tripData.new_trip_identifier},
              ${tripData.vehicle_number},
              ${tripData.planned_loading_time},
              ${tripData.driver_comment || null},
              CURRENT_TIMESTAMP
            FROM users 
            WHERE phone = ${phone}
            LIMIT 1
          `
        } else {
          // Обработка существующего рейса
          if (tripData.is_restored) {
            // Восстановление удаленного рейса
            console.log(`Restoring trip: ${originalTripIdentifier}`)
            
            await sql`
              UPDATE trip_messages 
              SET status = 'sent',
                  response_status = 'pending',
                  response_comment = NULL,
                  response_at = NULL,
                  trip_identifier = ${tripData.new_trip_identifier},
                  vehicle_number = ${tripData.vehicle_number},
                  planned_loading_time = ${tripData.planned_loading_time},
                  driver_comment = ${tripData.driver_comment || null}
              WHERE trip_id = ${tripId} 
                AND phone = ${phone} 
                AND trip_identifier = ${originalTripIdentifier}
                AND status = 'deleted'
            `
          } else {
            // Обновление активного рейса
            console.log(`Updating trip: ${originalTripIdentifier} -> ${tripData.new_trip_identifier}`)
            
            await sql`
              UPDATE trip_messages 
              SET trip_identifier = ${tripData.new_trip_identifier},
                  vehicle_number = ${tripData.vehicle_number},
                  planned_loading_time = ${tripData.planned_loading_time},
                  driver_comment = ${tripData.driver_comment || null},
                  response_status = 'pending',
                  response_comment = NULL,
                  response_at = NULL
              WHERE trip_id = ${tripId} 
                AND phone = ${phone} 
                AND trip_identifier = ${originalTripIdentifier}
                AND status = 'sent'
            `
          }
        }

        // 4. Добавляем новые точки для рейса
        // Важно: старые точки не удаляем, оставляем в БД как исторические данные
        for (const point of tripData.points) {
          // Получаем ID точки из таблицы points
          const pointResult = await sql`
            SELECT id FROM points WHERE point_id = ${point.point_id}
          `

          if (pointResult.length > 0) {
            await sql`
              INSERT INTO trip_points (
                trip_id, 
                point_id, 
                point_type, 
                point_num, 
                trip_identifier
              )
              VALUES (
                ${tripId}, 
                ${pointResult[0].id}, 
                ${point.point_type}, 
                ${point.point_num}, 
                ${tripData.new_trip_identifier}
              )
              ON CONFLICT (trip_id, point_id, trip_identifier, point_type, point_num) 
              DO NOTHING
            `
          }
        }
      }

      await sql`COMMIT`

      console.log(
        `Corrections saved successfully. Updated: ${originalTripGroups.size} trips, Deleted: ${deletedTrips.length} trips`
      )

      return NextResponse.json({
        success: true,
        message: "Corrections saved successfully",
        updatedTrips: originalTripGroups.size,
        deletedTrips: deletedTrips.length,
      })
    } catch (error) {
      await sql`ROLLBACK`
      console.error("Error during transaction:", error)
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
