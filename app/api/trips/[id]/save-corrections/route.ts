//app/api/trips/[id]/save-corrections/route.ts

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { normalizePhoneNumber } from "@/lib/utils"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, driver_phone, corrections, deletedTrips = [] } = await request.json()

  if (!tripId || !phone || !driver_phone || !corrections) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
  }

  const normalizedPhone = normalizePhoneNumber(phone)
  const normalizedDriverPhone = normalizePhoneNumber(driver_phone)

  const client = await sql.connect()

  try {
    await client.query("BEGIN")

    // 1. Handle deleted trips
    if (deletedTrips.length > 0) {
      await client.query(`DELETE FROM trips WHERE trip_identifier = ANY($1::text[]) AND driver_phone = $2`, [
        deletedTrips,
        normalizedDriverPhone,
      ])
      console.log(`Deleted trips: ${deletedTrips.join(", ")} for driver ${normalizedDriverPhone}`)
    }

    // 2. Process corrections
    for (const correction of corrections) {
      const {
        trip_identifier,
        original_trip_identifier,
        vehicle_number,
        planned_loading_time,
        driver_comment,
        message_id,
        points,
      } = correction

      const currentTripIdentifier = original_trip_identifier || trip_identifier

      // Check for conflicts if trip_identifier is being changed or it's a new trip
      if (
        (original_trip_identifier && original_trip_identifier !== trip_identifier) ||
        !original_trip_identifier // This means it's a new trip being added
      ) {
        const { rows: existingTrips } = await client.query(
          `SELECT id, driver_phone FROM trips WHERE trip_identifier = $1 AND driver_phone != $2`,
          [trip_identifier, normalizedDriverPhone],
        )

        if (existingTrips.length > 0) {
          const conflictData = await Promise.all(
            existingTrips.map(async (row) => {
              const { rows: driverInfo } = await client.query(
                `SELECT name, first_name, full_name FROM users WHERE phone = $1`,
                [row.driver_phone],
              )
              const driverName =
                driverInfo[0]?.full_name || driverInfo[0]?.first_name || driverInfo[0]?.name || row.driver_phone
              return {
                trip_identifier: trip_identifier,
                driver_phone: row.driver_phone,
                driver_name: driverName,
                trip_id: row.id,
              }
            }),
          )
          await client.query("ROLLBACK")
          return NextResponse.json(
            {
              success: false,
              error: "trip_already_assigned",
              trip_identifiers: [trip_identifier],
              conflict_data: conflictData,
            },
            { status: 409 },
          )
        }
      }

      let currentTripDbId: number

      if (original_trip_identifier) {
        // Update existing trip
        const { rows: updatedTrip } = await client.query(
          `UPDATE trips
           SET
             trip_identifier = $1,
             vehicle_number = $2,
             planned_loading_time = $3,
             driver_comment = $4,
             status = 'pending_correction' -- Reset status on correction
           WHERE trip_identifier = $5 AND driver_phone = $6
           RETURNING id;`,
          [
            trip_identifier,
            vehicle_number,
            planned_loading_time,
            driver_comment,
            original_trip_identifier,
            normalizedDriverPhone,
          ],
        )
        currentTripDbId = updatedTrip[0].id

        // Delete old points for this trip
        await client.query(`DELETE FROM trip_points WHERE trip_id = $1`, [currentTripDbId])
      } else {
        // Insert new trip
        const { rows: newTrip } = await client.query(
          `INSERT INTO trips (trip_identifier, driver_phone, vehicle_number, planned_loading_time, driver_comment, status)
           VALUES ($1, $2, $3, $4, $5, 'pending_correction')
           RETURNING id;`,
          [trip_identifier, normalizedDriverPhone, vehicle_number, planned_loading_time, driver_comment],
        )
        currentTripDbId = newTrip[0].id

        // Insert into trip_messages for the new trip
        await client.query(
          `INSERT INTO trip_messages (trip_id, driver_phone, message_sent_at, status)
           VALUES ($1, $2, NOW(), 'pending_send');`,
          [currentTripDbId, normalizedDriverPhone],
        )
      }

      // Insert new points
      for (const point of points) {
        await client.query(
          `INSERT INTO trip_points (trip_id, point_id, point_type, point_num)
           VALUES ($1, $2, $3, $4);`,
          [currentTripDbId, point.point_id, point.point_type, point.point_num],
        )
      }
    }

    // Получаем данные о рейсах для отправки сообщения
    const { rows: messages } = await client.query(
      `SELECT 
        tm.id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tm.driver_phone,
        u.first_name,
        u.full_name,
        tm.telegram_message_id,
        p.point_id,
        p.point_name,
        p.adress,
        tp.point_type,
        tp.point_num,
        p.latitude,
        p.longitude,
        p.door_open_1,
        p.door_open_2,
        p.door_open_3
      FROM trip_messages tm
      LEFT JOIN trip_points tp ON tm.trip_id = tp.trip_id AND tm.trip_identifier = tp.trip_identifier
      LEFT JOIN points p ON tp.point_id = p.id
      LEFT JOIN users u ON tm.driver_phone = u.phone
      WHERE tm.trip_id = $1
        AND tm.driver_phone = $2
      ORDER BY tm.planned_loading_time, tp.point_num`,
      [tripId, normalizedDriverPhone],
    )

    if (messages.length === 0) {
      await client.query("ROLLBACK")
      return NextResponse.json({ success: false, error: "Messages not found" }, { status: 404 })
    }

    // Группируем точки по trip_identifier
    const tripsMap = new Map<string, any>()
    for (const row of messages) {
      if (!tripsMap.has(row.trip_identifier)) {
        tripsMap.set(row.trip_identifier, {
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment || "",
          loading_points: [],
          unloading_points: [],
          all_points: [], // Добавляем массив для всех точек в порядке point_num
        })
      }

      if (row.point_id) {
        const point = {
          point_id: row.point_id,
          point_name: row.point_name,
          adress: row.adress,
          door_open_1: row.door_open_1,
          door_open_2: row.door_open_2,
          door_open_3: row.door_open_3,
          latitude: row.latitude,
          longitude: row.longitude,
          point_type: row.point_type,
          point_num: row.point_num,
        }

        const trip = tripsMap.get(row.trip_identifier)!
        trip.all_points.push(point)
      }
    }

    // Сортируем точки по point_num и разделяем по типам, сохраняя порядок
    for (const [tripIdentifier, tripData] of tripsMap) {
      // Сортируем все точки по point_num
      tripData.all_points.sort((a, b) => (a.point_num || 0) - (b.point_num || 0))

      // Разделяем на loading и unloading, сохраняя порядок
      for (const point of tripData.all_points) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          adress: point.adress,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          point_num: point.point_num,
        }

        if (point.point_type === "P") {
          tripData.loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          tripData.unloading_points.push(pointInfo)
        }
      }

      // Удаляем временный массив
      delete tripData.all_points
    }

    const trips = Array.from(tripsMap.values())
    trips.sort((a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime())

    const telegramId = messages[0].driver_phone
    const driverName = messages[0].first_name || messages[0].full_name || "Водитель"
    const previousTelegramMessageId = messages[0].telegram_message_id
    const messageIds = messages.map((m) => m.id)

    // Отправляем сообщение с корректировкой
    const { message_id, messageText } = await sendMultipleTripMessageWithButtons(
      Number(telegramId),
      trips,
      driverName,
      messageIds[0], // Используем первый messageId для callback_data
      true, // isCorrection = true
      false, // isResend = false
      previousTelegramMessageId,
    )

    // Обновляем все сообщения водителя с новым telegram_message_id и текстом
    await client.query(
      `UPDATE trip_messages
       SET 
         telegram_message_id = $1,
         status = 'sent',
         message_sent_at = NOW(),
         message = $2
       WHERE id = ANY($3)
       AND driver_phone = $4;`,
      [message_id, messageText, messageIds, normalizedDriverPhone],
    )

    await client.query("COMMIT")

    console.log(`Corrections saved successfully for ${corrections.length} trips, deleted ${deletedTrips.length} trips`)

    return NextResponse.json({
      success: true,
      message: "Corrections saved successfully",
      updatedTrips: corrections.length,
      deletedTrips: deletedTrips.length,
    })
  } catch (error: any) {
    await client.query("ROLLBACK")
    console.error("Error saving corrections:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to save corrections" }, { status: 500 })
  } finally {
    client.release()
  }
}
