import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { phone, driver_phone, corrections, deletedTrips } = body

    console.log("=== SAVE CORRECTIONS REQUEST ===")
    console.log("Trip ID:", params.id)
    console.log("Phone:", phone)
    console.log("Driver Phone:", driver_phone)
    console.log("Corrections:", JSON.stringify(corrections, null, 2))
    console.log("Deleted Trips:", deletedTrips)

    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
      return NextResponse.json({ success: false, error: "No corrections provided" }, { status: 400 })
    }

    // Группируем корректировки по trip_identifier
    const tripGroups = corrections.reduce((groups: any, correction: any) => {
      const tripId = correction.trip_identifier
      if (!groups[tripId]) {
        groups[tripId] = []
      }
      groups[tripId].push(correction)
      return groups
    }, {})

    console.log("Trip groups:", Object.keys(tripGroups))

    // Обрабатываем каждую группу рейсов
    for (const [tripIdentifier, tripCorrections] of Object.entries(tripGroups)) {
      const corrections_array = tripCorrections as any[]
      const firstCorrection = corrections_array[0]

      console.log(`Processing trip: ${tripIdentifier}`)
      console.log(`Original trip identifier: ${firstCorrection.original_trip_identifier}`)

      // Получаем существующие записи по original_trip_identifier
      const existingRecordsResult = await query(
        `SELECT DISTINCT tm.id, tm.trip_identifier, tm.message_id, tm.telegram_message_id
         FROM trip_messages tm 
         WHERE tm.trip_identifier = $1 AND tm.phone = $2`,
        [firstCorrection.original_trip_identifier, phone],
      )

      let messageId = firstCorrection.message_id
      let previousTelegramMessageId = null

      if (existingRecordsResult.rows.length > 0) {
        // Обновляем существующие записи
        messageId = existingRecordsResult.rows[0].message_id
        previousTelegramMessageId = existingRecordsResult.rows[0].telegram_message_id

        console.log(`Found existing records for trip ${firstCorrection.original_trip_identifier}`)
        console.log(`Message ID: ${messageId}`)
        console.log(`Previous Telegram Message ID: ${previousTelegramMessageId}`)

        // Удаляем старые записи trip_points для этого рейса
        await query(`DELETE FROM trip_points WHERE trip_identifier = $1 AND phone = $2`, [
          firstCorrection.original_trip_identifier,
          phone,
        ])

        // Обновляем trip_messages
        await query(
          `UPDATE trip_messages 
           SET trip_identifier = $1, 
               vehicle_number = $2, 
               planned_loading_time = $3, 
               driver_comment = $4,
               message = $5,
               updated_at = NOW()
           WHERE trip_identifier = $6 AND phone = $7`,
          [
            tripIdentifier,
            firstCorrection.vehicle_number,
            firstCorrection.planned_loading_time,
            firstCorrection.driver_comment,
            "Корректировка рейса",
            firstCorrection.original_trip_identifier,
            phone,
          ],
        )
      } else {
        // Создаем новые записи
        console.log(`Creating new records for trip ${tripIdentifier}`)

        await query(
          `INSERT INTO trip_messages (
            phone, driver_phone, trip_identifier, vehicle_number, 
            planned_loading_time, driver_comment, message_id, message, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            phone,
            driver_phone,
            tripIdentifier,
            firstCorrection.vehicle_number,
            firstCorrection.planned_loading_time,
            firstCorrection.driver_comment,
            messageId,
            "Корректировка рейса",
          ],
        )
      }

      // Добавляем новые точки
      for (const correction of corrections_array) {
        await query(
          `INSERT INTO trip_points (
            phone, driver_phone, trip_identifier, point_type, point_num, 
            point_id, point_name, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            phone,
            driver_phone,
            tripIdentifier,
            correction.point_type,
            correction.point_num,
            correction.point_id,
            correction.point_name,
          ],
        )
      }
    }

    // Получаем обновленные данные для отправки сообщения
    const tripsResult = await query(
      `SELECT DISTINCT tm.trip_identifier, tm.vehicle_number, tm.planned_loading_time, 
              tm.driver_comment, tm.message_id, tm.telegram_message_id
       FROM trip_messages tm 
       WHERE tm.phone = $1 AND tm.trip_identifier = ANY($2)
       ORDER BY tm.planned_loading_time`,
      [phone, Object.keys(tripGroups)],
    )

    if (tripsResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "No trips found after corrections" }, { status: 404 })
    }

    // Получаем информацию о пользователе
    const userResult = await query("SELECT first_name, telegram_id FROM users WHERE phone = $1", [phone])

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const user = userResult.rows[0]
    const messageId = tripsResult.rows[0].message_id
    const previousTelegramMessageId = tripsResult.rows[0].telegram_message_id

    // Формируем данные для отправки сообщения
    const trips = []

    for (const tripRow of tripsResult.rows) {
      // Получаем точки для каждого рейса, отсортированные по point_num
      const pointsResult = await query(
        `SELECT tp.point_type, tp.point_num, tp.point_id, tp.point_name,
                p.door_open_1, p.door_open_2, p.door_open_3, 
                p.latitude, p.longitude, p.adress
         FROM trip_points tp
         LEFT JOIN points p ON tp.point_id = p.point_id
         WHERE tp.trip_identifier = $1 AND tp.phone = $2
         ORDER BY tp.point_num`,
        [tripRow.trip_identifier, phone],
      )

      const loading_points: any[] = []
      const unloading_points: any[] = []

      // Разделяем точки по типам, сохраняя порядок по point_num
      for (const point of pointsResult.rows) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
          adress: point.adress,
          point_num: point.point_num?.toString(),
        }

        if (point.point_type === "P") {
          loading_points.push(pointInfo)
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo)
        }
      }

      trips.push({
        trip_identifier: tripRow.trip_identifier,
        vehicle_number: tripRow.vehicle_number,
        planned_loading_time: tripRow.planned_loading_time,
        driver_comment: tripRow.driver_comment,
        loading_points,
        unloading_points,
      })
    }

    console.log("Sending corrected message to Telegram...")
    console.log(`User: ${user.first_name}, Telegram ID: ${user.telegram_id}`)
    console.log(`Message ID: ${messageId}`)
    console.log(`Previous Telegram Message ID: ${previousTelegramMessageId}`)

    // Отправляем сообщение в Telegram с флагом isCorrection = true
    const telegramResult = await sendMultipleTripMessageWithButtons(
      user.telegram_id,
      trips,
      user.first_name,
      messageId,
      true, // isCorrection = true
      false, // isResend = false
      previousTelegramMessageId,
    )

    // Обновляем telegram_message_id в базе данных
    await query(
      `UPDATE trip_messages 
       SET telegram_message_id = $1, updated_at = NOW()
       WHERE message_id = $2 AND phone = $3`,
      [telegramResult.message_id, messageId, phone],
    )

    console.log("Corrections saved and message sent successfully")

    return NextResponse.json({
      success: true,
      message: "Corrections saved successfully",
      telegram_message_id: telegramResult.message_id,
      trips_updated: Object.keys(tripGroups).length,
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
