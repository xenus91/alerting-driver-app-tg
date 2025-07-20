import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { corrections, deletedTrips } = await request.json()
    console.log("=== SAVE CORRECTIONS REQUEST ===")
    console.log("Trip ID:", params.id)
    console.log("Corrections:", JSON.stringify(corrections, null, 2))
    console.log("Deleted trips:", deletedTrips)

    if (!corrections || corrections.length === 0) {
      return NextResponse.json({ success: false, error: "No corrections provided" })
    }

    // Группируем корректировки по trip_identifier
    const tripGroups = corrections.reduce((groups: any, correction: any) => {
      const key = correction.trip_identifier
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(correction)
      return groups
    }, {})

    console.log("Trip groups:", Object.keys(tripGroups))

    // Обрабатываем каждую группу рейсов
    for (const [tripIdentifier, tripCorrections] of Object.entries(tripGroups)) {
      const corrections_array = tripCorrections as any[]
      const firstCorrection = corrections_array[0]

      console.log(`Processing trip: ${tripIdentifier}`)
      console.log(`Original trip identifier: ${firstCorrection.original_trip_identifier}`)

      // Обновляем основную информацию о рейсе в trip_messages
      const updateTripResult = await query(
        `UPDATE trip_messages 
         SET trip_identifier = $1, 
             vehicle_number = $2, 
             planned_loading_time = $3, 
             driver_comment = $4
         WHERE trip_identifier = $5 AND message_id = $6`,
        [
          tripIdentifier,
          firstCorrection.vehicle_number,
          firstCorrection.planned_loading_time,
          firstCorrection.driver_comment,
          firstCorrection.original_trip_identifier,
          firstCorrection.message_id,
        ],
      )

      console.log(`Updated trip_messages for ${tripIdentifier}:`, updateTripResult.rowCount)

      // Удаляем старые точки для этого рейса
      const deletePointsResult = await query(`DELETE FROM trip_points WHERE trip_identifier = $1`, [
        firstCorrection.original_trip_identifier,
      ])

      console.log(`Deleted old points for ${firstCorrection.original_trip_identifier}:`, deletePointsResult.rowCount)

      // Добавляем новые точки
      for (const correction of corrections_array) {
        const insertPointResult = await query(
          `INSERT INTO trip_points (
            trip_identifier, point_type, point_num, point_id, point_name
          ) VALUES ($1, $2, $3, $4, $5)`,
          [tripIdentifier, correction.point_type, correction.point_num, correction.point_id, correction.point_name],
        )

        console.log(`Inserted point ${correction.point_id} for trip ${tripIdentifier}`)
      }

      // Обновляем trip_identifier во всех связанных таблицах
      await query(`UPDATE trip_points SET trip_identifier = $1 WHERE trip_identifier = $2`, [
        tripIdentifier,
        firstCorrection.original_trip_identifier,
      ])
    }

    // Получаем обновленные данные для отправки сообщения
    const messageId = corrections[0].message_id

    const tripDataResult = await query(
      `SELECT DISTINCT 
         tm.trip_identifier,
         tm.vehicle_number,
         tm.planned_loading_time,
         tm.driver_comment,
         tm.telegram_message_id,
         u.first_name,
         u.telegram_id
       FROM trip_messages tm
       JOIN users u ON tm.phone = u.phone
       WHERE tm.message_id = $1`,
      [messageId],
    )

    if (tripDataResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Trip not found" })
    }

    const tripData = tripDataResult.rows[0]

    // Получаем все точки для всех рейсов этого сообщения
    const pointsResult = await query(
      `SELECT 
         tp.trip_identifier,
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
       JOIN points p ON tp.point_id = p.point_id
       JOIN trip_messages tm ON tp.trip_identifier = tm.trip_identifier
       WHERE tm.message_id = $1
       ORDER BY tp.point_num`,
      [messageId],
    )

    // Группируем точки по рейсам
    const tripsData = tripDataResult.rows.reduce((trips: any[], row: any) => {
      const existingTrip = trips.find((t) => t.trip_identifier === row.trip_identifier)
      if (!existingTrip) {
        trips.push({
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment || "",
          loading_points: [],
          unloading_points: [],
        })
      }
      return trips
    }, [])

    // Распределяем точки по рейсам
    pointsResult.rows.forEach((point: any) => {
      const trip = tripsData.find((t) => t.trip_identifier === point.trip_identifier)
      if (trip) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          adress: point.adress,
          point_num: point.point_num,
        }

        if (point.point_type === "P") {
          trip.loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          trip.unloading_points.push(pointInfo)
        }
      }
    })

    // Отправляем обновленное сообщение
    const telegramResult = await sendMultipleTripMessageWithButtons(
      tripData.telegram_id,
      tripsData,
      tripData.first_name,
      messageId,
      true, // isCorrection = true
      false, // isResend = false
      tripData.telegram_message_id,
    )

    // Обновляем telegram_message_id
    await query(`UPDATE trip_messages SET telegram_message_id = $1 WHERE message_id = $2`, [
      telegramResult.message_id,
      messageId,
    ])

    console.log("=== CORRECTIONS SAVED SUCCESSFULLY ===")

    return NextResponse.json({
      success: true,
      message: "Corrections saved and message sent successfully",
      telegramMessageId: telegramResult.message_id,
    })
  } catch (error) {
    console.error("Error saving corrections:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to save corrections",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
