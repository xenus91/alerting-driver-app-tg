import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest, { params }: { params: { tripId: string } }) {
  const tripId = Number.parseInt(params.tripId);
  const { phone, corrections, deletedTrips = [] } = await request.json();

  try {
    console.log(`Saving corrections for tripId: ${tripId}, phone: ${phone}, deletedTrips:`, deletedTrips);

    // Начинаем транзакцию
    await sql`BEGIN`;

    // Удаляем или помечаем удаленные рейсы
    for (const tripIdentifier of deletedTrips) {
      await sql`
        UPDATE trip_messages
        SET status = 'deleted'
        WHERE trip_id = ${tripId}
          AND phone = ${phone}
          AND trip_identifier = ${tripIdentifier}
      `;
      await sql`
        DELETE FROM trip_points
        WHERE trip_id = ${tripId}
          AND trip_identifier = ${tripIdentifier}
      `;
    }

    // Сохраняем или обновляем рейсы
    for (const correction of corrections) {
      const {
        trip_identifier,
        vehicle_number,
        planned_loading_time,
        driver_comment,
        message_id,
        point_type,
        point_num,
        point_id,
        point_name,
        latitude,
        longitude,
      } = correction;

      // Проверяем, существует ли запись в trip_messages
      const existingMessage = await sql`
        SELECT id FROM trip_messages
        WHERE trip_id = ${tripId}
          AND phone = ${phone}
          AND trip_identifier = ${trip_identifier}
        LIMIT 1
      `;

      let msgId = message_id;
      if (existingMessage.length > 0) {
        // Обновляем существующую запись
        await sql`
          UPDATE trip_messages
          SET vehicle_number = ${vehicle_number},
              planned_loading_time = ${planned_loading_time},
              driver_comment = ${driver_comment || null},
              status = 'sent'
          WHERE id = ${existingMessage[0].id}
        `;
        msgId = existingMessage[0].id;
      } else {
        // Создаем новую запись
        const newMessage = await sql`
          INSERT INTO trip_messages (
            trip_id,
            phone,
            trip_identifier,
            vehicle_number,
            planned_loading_time,
            driver_comment,
            status
          ) VALUES (
            ${tripId},
            ${phone},
            ${trip_identifier},
            ${vehicle_number},
            ${planned_loading_time},
            ${driver_comment || null},
            'sent'
          ) RETURNING id
        `;
        msgId = newMessage[0].id;
      }

      // Удаляем старые точки для этого trip_identifier
      await sql`
        DELETE FROM trip_points
        WHERE trip_id = ${tripId}
          AND trip_identifier = ${trip_identifier}
      `;

      // Добавляем новые точки
      await sql`
        INSERT INTO trip_points (
          trip_id,
          trip_identifier,
          point_type,
          point_num,
          point_id,
          latitude,
          longitude
        ) VALUES (
          ${tripId},
          ${trip_identifier},
          ${point_type},
          ${point_num},
          ${point_id},
          ${latitude || null},
          ${longitude || null}
        )
      `;
    }

    // Завершаем транзакцию
    await sql`COMMIT`;

    return NextResponse.json({ success: true, message: "Corrections saved successfully" });
  } catch (error) {
    await sql`ROLLBACK`;
    console.error("Error saving corrections:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save corrections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
