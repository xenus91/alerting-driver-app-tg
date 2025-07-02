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

    await sql`BEGIN`

    try {
      // Группируем корректировки по trip_identifier
      const tripGroups = new Map()

      for (const correction of corrections) {
        const tripKey = correction.trip_identifier
        if (!tripGroups.has(tripKey)) {
          tripGroups.set(tripKey, {
            trip_identifier: tripKey,
            original_trip_identifier: correction.original_trip_identifier,
            vehicle_number: correction.vehicle_number,
            planned_loading_time: correction.planned_loading_time,
            driver_comment: correction.driver_comment,
            message_id: correction.message_id,
            points: [],
          })
        }
        if (correction.point_id) {
          tripGroups.get(tripKey).points.push({
            point_type: correction.point_type,
            point_num: correction.point_num,
            point_id: correction.point_id,
          })
        }
      }

      // Обрабатываем каждый рейс
      for (const [tripIdentifier, tripData] of tripGroups) {
        const isNewTrip = !tripData.original_trip_identifier || tripData.original_trip_identifier.startsWith("NEW_")
        
        if (isNewTrip) {
          console.log(`Creating new trip message for trip: ${tripIdentifier}`)
          const newMessage = await sql`
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
              ${tripIdentifier},
              ${tripData.vehicle_number},
              ${tripData.planned_loading_time},
              ${tripData.driver_comment || null},
              CURRENT_TIMESTAMP
            FROM users 
            WHERE phone = ${phone}
            LIMIT 1
            RETURNING id
          `
          tripData.message_id = newMessage[0].id
          console.log(`Created new trip message for ${tripIdentifier}, message_id: ${tripData.message_id}`)
        } else {
          console.log(`Updating existing trip message for ${tripData.original_trip_identifier} -> ${tripIdentifier}`)
          await sql`
            UPDATE trip_messages 
            SET trip_identifier = ${tripIdentifier},
                vehicle_number = ${tripData.vehicle_number},
                planned_loading_time = ${tripData.planned_loading_time},
                driver_comment = ${tripData.driver_comment || null},
                response_status = 'pending',
                response_comment = NULL,
                response_at = NULL
            WHERE trip_id = ${tripId} 
              AND phone = ${phone} 
              AND trip_identifier = ${tripData.original_trip_identifier}
          `
        }

        // Удаляем старые точки для этого рейса
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND trip_identifier = ${isNewTrip ? tripIdentifier : tripData.original_trip_identifier}
        `

        // Добавляем новые точки
        for (const point of tripData.points) {
          const pointResult = await sql`
            SELECT id FROM points WHERE point_id = ${point.point_id}
          `
          if (pointResult.length > 0) {
            await sql`
              INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier)
              VALUES (${tripId}, ${pointResult[0].id}, ${point.point_type}, ${point.point_num}, ${tripIdentifier})
            `
            console.log(`Added point ${point.point_id} to trip ${tripIdentifier}`)
          }
        }
      }

      await sql`COMMIT`

      return NextResponse.json({
        success: true,
        message: "Corrections saved successfully",
        updatedTrips: tripGroups.size,
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
