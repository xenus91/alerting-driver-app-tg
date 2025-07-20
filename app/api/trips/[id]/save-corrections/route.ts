//app/api/trips/[id]/save-corrections/route.ts

import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
/* === ИСПРАВЛЕНИЕ ===
 * Добавлен импорт функции sendMultipleTripMessageWithButtons из @/lib/telegram,
 * чтобы устранить ошибку "ReferenceError: sendMultipleTripMessageWithButtons is not defined".
 */
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"
/* === КОНЕЦ ИСПРАВЛЕНИЯ === */

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tripId = Number.parseInt(params.id)
  const { phone, corrections, deletedTrips = [] } = await request.json()

  try {
    console.log(`Saving corrections for trip ${tripId}, phone ${phone}`)
    console.log("Corrections data:", corrections)
    console.log("Deleted trips:", deletedTrips)
    /* === ПРОВЕРКА КОНФЛИКТУЮЩИХ РЕЙСОВ === */
    const identifiersToCheck = [...deletedTrips, ...corrections.map((c: any) => String(c.trip_identifier))].filter(
      (value, index, self) => self.indexOf(value) === index,
    )

    if (identifiersToCheck.length > 0) {
      console.log(`Checking conflicts for identifiers: ${identifiersToCheck.join(", ")}`)

      const conflictingTrips = await sql`
        SELECT 
          tm.trip_identifier,
          tm.trip_id, 
          tm.phone,
          u.first_name,
          u.full_name
        FROM trip_messages tm
        LEFT JOIN users u ON u.phone = tm.phone
        WHERE tm.trip_identifier = ANY(${identifiersToCheck}::text[])
          AND tm.phone <> ${phone}
          AND (tm.response_status IS NULL OR tm.response_status NOT IN ('declined', 'rejected', 'error'))
      `

      if (conflictingTrips.length > 0) {
        const conflictData = conflictingTrips.map((t) => ({
          trip_identifier: t.trip_identifier,
          driver_phone: t.phone,
          driver_name: t.full_name || t.first_name || t.phone,
          trip_id: t.trip_id, // Добавляем ID поездки
        }))

        console.log(`Conflict found for trips: ${conflictData.map((c) => c.trip_identifier).join(", ")}`)

        return NextResponse.json(
          {
            success: false,
            error: "trip_already_assigned",
            trip_identifiers: conflictData.map((c) => c.trip_identifier),
            conflict_data: conflictData,
          },
          { status: 409 },
        )
      } else {
        console.log("No trip conflicts found")
      }
    }
    /* === КОНЕЦ ПРОВЕРКИ КОНФЛИКТОВ === */
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
            AND driver_phone = ${phone} 
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
          console.log(`Creating new trip message for trip: ${tripData.new_trip_identifier}`)

          // Создаем новое сообщение для нового рейса со статусом 'sent'
          // чтобы оно было включено в отправку корректировки
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

          console.log(`Created new trip message for ${tripData.new_trip_identifier}`)
        } else {
          // Обновляем существующее сообщение и сбрасываем статус подтверждения
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
          `

          console.log(`Updated existing trip message for ${originalTripIdentifier} -> ${tripData.new_trip_identifier}`)
        }

        // Удаляем старые точки для этого рейса (используем original_trip_identifier)
        await sql`
          DELETE FROM trip_points 
          WHERE trip_id = ${tripId} 
            AND driver_phone = ${phone} 
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
              INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier, driver_phone )
              VALUES (${tripId}, ${pointResult[0].id}, ${point.point_type}, ${point.point_num}, ${tripData.new_trip_identifier}, ${phone} )
            `

            console.log(`Added point ${point.point_id} to trip ${tripData.new_trip_identifier}`)
          }
        }
      }
      /* === ИСПРАВЛЕННЫЙ БЛОК ===
       * Исправлена ошибка обращения к несуществующему столбцу tm.driver_name.
       * Вместо tm.driver_name используется u.first_name из таблицы users.
       * Добавлено соединение с таблицей users в SQL-запросе для получения имени водителя.
       * Сохранена остальная логика формирования trips и отправки сообщения.
       */
      // Получаем данные о рейсах для отправки сообщения
      const messages = await sql`
SELECT 
  tm.id,
  tm.trip_identifier,
  tm.vehicle_number,
  tm.planned_loading_time,
  tm.driver_comment,
  tm.telegram_id,
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
LEFT JOIN (
  SELECT * FROM trip_points 
  WHERE driver_phone = ${phone}  
) tp ON tm.trip_id = tp.trip_id AND tm.trip_identifier = tp.trip_identifier
LEFT JOIN points p ON tp.point_id = p.id
LEFT JOIN users u ON tm.telegram_id = u.telegram_id
WHERE tm.trip_id = ${tripId}
  AND tm.phone = ${phone}
ORDER BY tm.planned_loading_time, tp.point_num
      `

      if (messages.length === 0) {
        await sql`ROLLBACK`
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

      const telegramId = messages[0].telegram_id
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
      await sql`
        UPDATE trip_messages
        SET 
          telegram_message_id = ${message_id},
          status = 'sent',
          sent_at = NOW(),
          message = ${messageText}
        WHERE id = ANY(${messageIds})
        AND phone = ${phone}
      `
      /* === КОНЕЦ ИСПРАВЛЕННОГО БЛОКА === */
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
