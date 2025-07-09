import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMultipleTripMessageWithButtons } from "@/lib/telegram";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const messageId = Number.parseInt(params.id);
  const { phone, messageIds, isCorrection = false, deletedTrips = [] } = await request.json();

  try {
    console.log(`Resending combined message for messageId: ${messageId}, phone: ${phone}`);
    console.log(`Is correction: ${isCorrection}, deleted trips:`, deletedTrips);

    // Получаем информацию о пользователе
    const userResult = await sql`
      SELECT telegram_id, first_name, full_name, name
      FROM users 
      WHERE phone = ${phone}
      LIMIT 1
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const user = userResult[0];
    const driverName = user.first_name || user.full_name || user.name || "Неизвестный водитель";

    // Получаем trip_id из первого сообщения
    const tripResult = await sql`
      SELECT trip_id FROM trip_messages WHERE id = ${messageId}
    `;

    if (tripResult.length === 0) {
      return NextResponse.json({ success: false, error: "Trip message not found" }, { status: 404 });
    }

    const tripId = tripResult[0].trip_id;

    // Получаем старый telegram_message_id для удаления
    const previousMessageResult = await sql`
      SELECT telegram_message_id
      FROM trip_messages
      WHERE trip_id = ${tripId} 
        AND phone = ${phone}
        AND telegram_message_id IS NOT NULL
      LIMIT 1
    `;

    let previousTelegramMessageId = null;
    if (previousMessageResult.length > 0) {
      previousTelegramMessageId = previousMessageResult[0].telegram_message_id;
    }

    // Получаем ВСЕ активные сообщения для этого пользователя и рейса
    const messagesResult = await sql`
      SELECT DISTINCT
        tm.id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment
      FROM trip_messages tm
      WHERE tm.trip_id = ${tripId} 
        AND tm.phone = ${phone}
        AND tm.status = 'sent'
        AND tm.trip_identifier IS NOT NULL
      ORDER BY tm.trip_identifier
    `;

    console.log(
      `Found ${messagesResult.length} messages to resend:`,
      messagesResult.map((m) => m.trip_identifier),
    );

    if (messagesResult.length === 0) {
      return NextResponse.json({ success: false, error: "No messages found to resend" }, { status: 404 });
    }

    // Собираем данные о рейсах для новой функции
    const trips = [];

    for (const message of messagesResult) {
      console.log(`Processing trip: ${message.trip_identifier}`);

      // Получаем точки для каждого рейса
      const pointsResult = await sql`
        SELECT DISTINCT
          tp.point_type,
          tp.point_num,
          p.point_id,
          p.point_name,
          p.adress,
          p.door_open_1,
          p.door_open_2,
          p.door_open_3,
          p.latitude,
          p.longitude
        FROM trip_points tp
        JOIN points p ON tp.point_id = p.id
        WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${message.trip_identifier}
        ORDER BY tp.point_type DESC, tp.point_num
      `;

      console.log(`Found ${pointsResult.length} points for trip ${message.trip_identifier}`);

      const loading_points = [];
      const unloading_points = [];

      for (const point of pointsResult) {
        const pointInfo = {
          point_id: point.point_id,
          point_name: point.point_name,
          point_adress: point.adress,
          door_open_1: point.door_open_1,
          door_open_2: point.door_open_2,
          door_open_3: point.door_open_3,
          latitude: point.latitude,
          longitude: point.longitude,
        };

        if (point.point_type === "P") {
          loading_points.push(pointInfo);
        } else if (point.point_type === "D") {
          unloading_points.push(pointInfo);
        }
      }

      trips.push({
        trip_identifier: message.trip_identifier,
        vehicle_number: message.vehicle_number,
        planned_loading_time: message.planned_loading_time,
        driver_comment: message.driver_comment || "",
        loading_points,
        unloading_points,
      });
    }

    console.log(`Prepared ${trips.length} trips for sending`);

    // Отправляем сообщение через новую функцию
    // === НАЧАЛО ИЗМЕНЕНИЙ ===
    const { message_id, messageText } = await sendMultipleTripMessageWithButtons(
      Number(user.telegram_id),
      trips,
      driverName,
      messageId,
      isCorrection, // Используем переданный isCorrection (обычно false для повторной отправки)
      true, // isResend = true для повторной отправки
      previousTelegramMessageId
    );
    // === КОНЕЦ ИЗМЕНЕНИЙ ===

    // Обновляем статусы всех сообщений
    const messageIdsToUpdate = messagesResult.map((m) => m.id);

    for (const msgId of messageIdsToUpdate) {
      // === НАЧАЛО ИЗМЕНЕНИЙ ===
      await sql`
        UPDATE trip_messages 
        SET telegram_message_id = ${message_id},
            response_status = 'pending',
            response_comment = NULL,
            response_at = NULL,
            sent_at = CURRENT_TIMESTAMP,
            message = ${messageText}  -- Добавлено сохранение текста сообщения
        WHERE id = ${msgId}
      `;
      // === КОНЕЦ ИЗМЕНЕНИЙ ===
    }

    console.log(`Successfully sent correction to ${user.telegram_id}, updated ${messageIdsToUpdate.length} messages`);

    return NextResponse.json({
      success: true,
      message: "Correction sent successfully",
      telegram_message_id: message_id, // Изменено с telegramResult.message_id на message_id
      trips_count: trips.length,
      updated_messages: messageIdsToUpdate.length,
    });
  } catch (error) {
    console.error("Error resending combined message:", error);

    // Обновляем статус сообщений при ошибке
    try {
      for (const msgId of messageIds) {
        await sql`
          UPDATE trip_messages 
          SET status = 'error', 
              error_message = ${error instanceof Error ? error.message : "Unknown error"}
          WHERE id = ${msgId}
        `;
      }
    } catch (updateError) {
      console.error("Error updating message status:", updateError);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
