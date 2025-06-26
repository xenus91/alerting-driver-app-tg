import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { phone, corrections, deletedTrips } = await request.json()
    const tripId = Number.parseInt(params.id)

    console.log("=== SAVE CORRECTIONS ===")
    console.log("Trip ID:", tripId)
    console.log("Phone:", phone)
    console.log("Corrections count:", corrections?.length || 0)
    console.log("Deleted trips:", deletedTrips)

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone is required" }, { status: 400 })
    }

    // Начинаем транзакцию
    await sql`BEGIN`

    try {
      // 1. Удаляем рейсы из deletedTrips
      if (deletedTrips && deletedTrips.length > 0) {
        console.log("Deleting trips:", deletedTrips)

        for (const tripIdentifier of deletedTrips) {
          // Удаляем из trip_messages
          await sql`
            DELETE FROM trip_messages 
            WHERE phone = ${phone} 
            AND trip_identifier = ${tripIdentifier}
          `

          // Удаляем из trip_points
          await sql`
            DELETE FROM trip_points 
            WHERE trip_identifier = ${tripIdentifier}
          `
        }
      }

      // 2. Обрабатываем корректировки
      if (corrections && corrections.length > 0) {
        // Группируем корректировки по trip_identifier
        const tripGroups = corrections.reduce((acc: any, correction: any) => {
          const key = correction.trip_identifier
          if (!acc[key]) {
            acc[key] = []
          }
          acc[key].push(correction)
          return acc
        }, {})

        for (const [tripIdentifier, tripCorrections] of Object.entries(tripGroups)) {
          const corrections = tripCorrections as any[]
          const firstCorrection = corrections[0]

          console.log(`Processing trip: ${tripIdentifier}`)

          // Проверяем, существует ли уже этот рейс
          const existingTrip = await sql`
            SELECT id FROM trip_messages 
            WHERE phone = ${phone} 
            AND trip_identifier = ${tripIdentifier}
            LIMIT 1
          `

          if (existingTrip.length > 0) {
            // Обновляем существующий рейс
            console.log(`Updating existing trip: ${tripIdentifier}`)

            await sql`
              UPDATE trip_messages 
              SET 
                vehicle_number = ${firstCorrection.vehicle_number},
                planned_loading_time = ${firstCorrection.planned_loading_time},
                driver_comment = ${firstCorrection.driver_comment || ""},
                response_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
              WHERE phone = ${phone} 
              AND trip_identifier = ${tripIdentifier}
            `

            // Удаляем старые точки
            await sql`
              DELETE FROM trip_points 
              WHERE trip_identifier = ${tripIdentifier}
            `
          } else {
            // Создаем новый рейс
            console.log(`Creating new trip: ${tripIdentifier}`)

            await sql`
              INSERT INTO trip_messages (
                trip_id, phone, trip_identifier, vehicle_number, 
                planned_loading_time, driver_comment, status, 
                response_status, sent_at, created_at
              ) VALUES (
                ${tripId}, ${phone}, ${tripIdentifier}, ${firstCorrection.vehicle_number},
                ${firstCorrection.planned_loading_time}, ${firstCorrection.driver_comment || ""},
                'sent', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `
          }

          // Добавляем новые точки
          for (const correction of corrections) {
            await sql`
              INSERT INTO trip_points (
                trip_id, trip_identifier, point_type, point_num, point_id, point_name,
                door_open_1, door_open_2, door_open_3, latitude, longitude, created_at
              ) VALUES (
                ${tripId}, ${tripIdentifier}, ${correction.point_type}, ${correction.point_num},
                ${correction.point_id}, ${correction.point_name}, ${correction.door_open_1 || null},
                ${correction.door_open_2 || null}, ${correction.door_open_3 || null},
                ${correction.latitude || null}, ${correction.longitude || null}, CURRENT_TIMESTAMP
              )
            `
          }
        }
      }

      // Коммитим транзакцию
      await sql`COMMIT`

      console.log("Corrections saved successfully")
      return NextResponse.json({ success: true })
    } catch (error) {
      // Откатываем транзакцию при ошибке
      await sql`ROLLBACK`
      throw error
    }
  } catch (error) {
    console.error("Error saving corrections:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
