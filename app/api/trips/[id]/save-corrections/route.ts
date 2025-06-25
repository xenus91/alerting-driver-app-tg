import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, corrections } = await request.json()

  try {
    console.log(`Saving corrections for trip ${tripId}, phone ${phone}`)
    console.log("Corrections data:", corrections)

    // Начинаем транзакцию
    await sql`BEGIN`

    try {
      // Группируем корректировки по trip_identifier
      const tripGroups = new Map()

      for (const correction of corrections) {
        if (!tripGroups.has(correction.trip_identifier)) {
          tripGroups.set(correction.trip_identifier, {
            trip_identifier: correction.trip_identifier,
            vehicle_number: correction.vehicle_number,
            planned_loading_time: correction.planned_loading_time,
            driver_comment: correction.driver_comment,
            points: [],
          })
        }

        if (correction.point_id) {
          tripGroups.get(correction.trip_identifier).points.push({
            point_type: correction.point_type,
            point_num: correction.point_num,
            point_id: correction.point_id,
          })
        }
      }

      // Обновляем данные сообщений
      for (const [tripIdentifier, tripData] of tripGroups) {
        await sql`
          UPDATE trip_messages 
          SET vehicle_number = ${tripData.vehicle_number},
              planned_loading_time = ${tripData.planned_loading_time},
              driver_comment = ${tripData.driver_comment || null}
          WHERE trip_id = ${tripId} 
            AND phone = ${phone} 
            AND trip_identifier = ${tripIdentifier}
        `

        // Удаляем старые точки для этого рейса
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND trip_identifier = ${tripIdentifier}
        `

        // Добавляем новые точки
        for (const point of tripData.points) {
          // Получаем ID точки из таблицы points
          const pointResult = await sql`
            SELECT id FROM points WHERE point_id = ${point.point_id}
          `

          if (pointResult.length > 0) {
            await sql`
              INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier)
              VALUES (${tripId}, ${pointResult[0].id}, ${point.point_type}, ${point.point_num}, ${tripIdentifier})
            `
          }
        }
      }

      await sql`COMMIT`

      console.log(`Corrections saved successfully for ${tripGroups.size} trips`)

      return NextResponse.json({
        success: true,
        message: "Corrections saved successfully",
        updatedTrips: tripGroups.size,
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
