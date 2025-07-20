import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getSession } from "@/lib/database"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tripId = params.id
  const sql = neon(process.env.DATABASE_URL!)

  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { phone, driver_phone, corrections, deletedTrips } = await req.json()

    if (!phone || !corrections) {
      return NextResponse.json({ success: false, error: "Missing phone or corrections data" }, { status: 400 })
    }

    await sql.transaction(async (tx) => {
      // 1. Проверяем конфликты для новых или измененных trip_identifier
      const newOrChangedTripIdentifiers = corrections
        .filter((c: any) => c.original_trip_identifier !== c.trip_identifier)
        .map((c: any) => c.trip_identifier)
        .concat(
          corrections
            .filter((c: any) => !c.original_trip_identifier) // Newly created trips
            .map((c: any) => c.trip_identifier),
        )

      if (newOrChangedTripIdentifiers.length > 0) {
        const conflictCheck = await tx`
          SELECT
            tm.trip_identifier,
            u.phone AS driver_phone,
            u.first_name || ' ' || u.last_name AS driver_name,
            tm.id AS trip_id
          FROM trip_messages tm
          JOIN users u ON tm.driver_phone = u.phone
          WHERE tm.trip_identifier IN (${sql(newOrChangedTripIdentifiers)})
          AND tm.driver_phone != ${driver_phone}
          AND tm.status != 'cancelled'
        `

        if (conflictCheck.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: "trip_already_assigned",
              trip_identifiers: conflictCheck.map((c: any) => c.trip_identifier),
              conflict_data: conflictCheck,
            },
            { status: 409 },
          )
        }
      }

      // 2. Удаляем старые точки для измененных или удаленных рейсов
      if (deletedTrips && deletedTrips.length > 0) {
        await tx`
          DELETE FROM trip_points
          WHERE trip_message_id IN (
            SELECT id FROM trip_messages WHERE trip_identifier IN (${sql(deletedTrips)}) AND driver_phone = ${driver_phone}
          )
        `
        await tx`
          DELETE FROM trip_messages
          WHERE trip_identifier IN (${sql(deletedTrips)}) AND driver_phone = ${driver_phone}
        `
      }

      // Группируем коррекции по trip_identifier для удобства обработки
      const groupedCorrections = corrections.reduce((acc: any, item: any) => {
        const key = item.original_trip_identifier || item.trip_identifier // Use original for existing, new for new
        if (!acc[key]) {
          acc[key] = {
            phone: item.phone,
            trip_identifier: item.trip_identifier,
            original_trip_identifier: item.original_trip_identifier,
            vehicle_number: item.vehicle_number,
            planned_loading_time: item.planned_loading_time,
            driver_comment: item.driver_comment,
            message_id: item.message_id,
            points: [],
          }
        }
        acc[key].points.push({
          point_type: item.point_type,
          point_num: item.point_num,
          point_id: item.point_id,
          point_name: item.point_name,
          latitude: item.latitude,
          longitude: item.longitude,
        })
        return acc
      }, {})

      for (const key in groupedCorrections) {
        const trip = groupedCorrections[key]
        let currentTripMessageId = trip.message_id

        // Если это существующий рейс, обновляем trip_messages и удаляем старые trip_points
        if (trip.original_trip_identifier) {
          const existingTrip = await tx`
            SELECT id FROM trip_messages
            WHERE trip_identifier = ${trip.original_trip_identifier} AND driver_phone = ${driver_phone}
          `
          if (existingTrip.length > 0) {
            currentTripMessageId = existingTrip[0].id
            await tx`
              UPDATE trip_messages
              SET
                trip_identifier = ${trip.trip_identifier},
                vehicle_number = ${trip.vehicle_number},
                planned_loading_time = ${trip.planned_loading_time},
                driver_comment = ${trip.driver_comment},
                status = 'pending' -- Сбрасываем статус при корректировке
              WHERE id = ${currentTripMessageId}
            `
            await tx`
              DELETE FROM trip_points WHERE trip_message_id = ${currentTripMessageId}
            `
          } else {
            // Если original_trip_identifier был, но запись не найдена, создаем новую
            const newTripMessage = await tx`
              INSERT INTO trip_messages (
                driver_phone, trip_identifier, vehicle_number, planned_loading_time, driver_comment, status
              ) VALUES (
                ${driver_phone}, ${trip.trip_identifier}, ${trip.vehicle_number}, ${trip.planned_loading_time}, ${trip.driver_comment}, 'pending'
              )
              RETURNING id
            `
            currentTripMessageId = newTripMessage[0].id
          }
        } else {
          // Если это новый рейс, вставляем в trip_messages
          const newTripMessage = await tx`
            INSERT INTO trip_messages (
              driver_phone, trip_identifier, vehicle_number, planned_loading_time, driver_comment, status
            ) VALUES (
              ${driver_phone}, ${trip.trip_identifier}, ${trip.vehicle_number}, ${trip.planned_loading_time}, ${trip.driver_comment}, 'pending'
            )
            RETURNING id
          `
          currentTripMessageId = newTripMessage[0].id
        }

        // Вставляем новые trip_points
        for (const point of trip.points) {
          await tx`
            INSERT INTO trip_points (
              trip_message_id, point_type, point_num, point_id
            ) VALUES (
              ${currentTripMessageId}, ${point.point_type}, ${point.point_num}, ${point.point_id}
            )
          `
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error saving corrections:", error)
    return NextResponse.json(
      { success: false, error: "Failed to save corrections", details: error.message },
      { status: 500 },
    )
  }
}
