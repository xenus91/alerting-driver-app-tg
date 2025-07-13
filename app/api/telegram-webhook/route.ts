import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

import { 
  sendReplyToMessage, 
  sendMessage, 
  editMessageReplyMarkup,
  forwardToSupport,
  isOperator,
  handleOperatorReply
} from "@/lib/telegram";

const sql = neon(process.env.DATABASE_URL!);

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  contact?: {
    phone_number: string;
    first_name: string;
    last_name?: string;
  };
}

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// НОВЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ТИКЕТАМИ
async function createSupportTicket(
  userId: number, 
  userTelegramId: number, 
  question: string,
  userMessageId: number
) {
  try {
    const result = await sql`
      INSERT INTO support_tickets 
        (user_id, user_telegram_id, question, user_message_id, status) 
      VALUES 
        (${userId}, ${userTelegramId}, ${question}, ${userMessageId}, 'open')
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    console.error("Error creating support ticket:", error);
    throw error;
  }
}
async function getActiveUserTicket(userId: number) {
  try {
    const result = await sql`
      SELECT * FROM support_tickets 
      WHERE user_id = ${userId} AND status = 'open'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    return result[0];
  } catch (error) {
    console.error("Error getting active ticket:", error);
    throw error;
  }
}

async function updateTicketStatus(ticketId: number, status: string) {
  try {
    await sql`
      UPDATE support_tickets 
      SET status = ${status}, closed_at = NOW()
      WHERE id = ${ticketId}
    `;
  } catch (error) {
    console.error("Error updating ticket status:", error);
    throw error;
  }
}

async function addMessageToTicket(ticketId: number, userId: number, message: string, isOperator: boolean = false) {
  try {
    await sql`
      INSERT INTO ticket_messages 
        (ticket_id, user_id, message, is_operator) 
      VALUES 
        (${ticketId}, ${userId}, ${message}, ${isOperator})
    `;
  } catch (error) {
    console.error("Error adding message to ticket:", error);
    throw error;
  }
}

async function sendMessageWithButtons(
  chatId: number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: buttons,
      },
    };

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || "Failed to send message with buttons");
    }

    return data.result;
  } catch (error) {
    console.error("Error sending Telegram message with buttons:", error);
    throw error;
  }
}

async function sendContactRequest(chatId: number) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Пожалуйста, поделитесь своим номером телефона для регистрации в системе рассылки.",
        reply_markup: {
          keyboard: [[{
            text: "📱 Поделиться номером",
            request_contact: true,
          }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || "Failed to send contact request");
    }

    return data.result;
  } catch (error) {
    console.error("Error sending contact request:", error);
    throw error;
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("Failed to answer callback query:", data.description);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error("Error answering callback query:", error);
    return null;
  }
}

async function createUser(telegramId: number, phone: string, name: string) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone;

    const result = await sql`
      INSERT INTO users (telegram_id, phone, name, registration_state)
      VALUES (${telegramId}, ${normalizedPhone}, ${name}, 'awaiting_first_name')
      ON CONFLICT (telegram_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        name = EXCLUDED.name,
        registration_state = 'awaiting_first_name'
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

async function getUserByTelegramId(telegramId: number) {
  try {
    const result = await sql`
      SELECT * FROM users WHERE telegram_id = ${telegramId}
    `;
    return result[0];
  } catch (error) {
    console.error("Error getting user by telegram id:", error);
    throw error;
  }
}

async function updateUserRegistrationStep(telegramId: number, step: string, data?: any) {
  try {
    let updateQuery;

    switch (step) {
      case "first_name":
        updateQuery = sql`
          UPDATE users 
          SET temp_first_name = ${data}, registration_state = 'awaiting_last_name'
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `;
        break;
      case "last_name":
        updateQuery = sql`
          UPDATE users 
          SET temp_last_name = ${data}, registration_state = 'awaiting_carpark'
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `;
        break;
      case "carpark":
        updateQuery = sql`
          UPDATE users 
          SET carpark = ${data}, 
              first_name = temp_first_name,
              last_name = temp_last_name,
              full_name = temp_first_name || ' ' || temp_last_name,
              registration_state = 'completed',
              temp_first_name = NULL,
              temp_last_name = NULL
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `;
        break;
      default:
        throw new Error(`Unknown registration step: ${step}`);
    }

    const result = await updateQuery;
    return result[0];
  } catch (error) {
    console.error("Error updating user registration step:", error);
    throw error;
  }
}

async function setUserPendingAction(userId: number, actionType: string, relatedMessageId?: number, actionData?: any) {
  try {
    const dataString = actionData ? JSON.stringify(actionData) : null;

    const result = await sql`
      INSERT INTO user_pending_actions (user_id, action_type, related_message_id, action_data)
      VALUES (${userId}, ${actionType}, ${relatedMessageId || null}, ${dataString})
      ON CONFLICT (user_id) DO UPDATE SET
        action_type = EXCLUDED.action_type,
        related_message_id = EXCLUDED.related_message_id,
        action_data = EXCLUDED.action_data,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    return result[0];
  } catch (error) {
    console.error("Error setting user pending action:", error);
    throw error;
  }
}

async function getUserPendingAction(userId: number) {
  try {
    const result = await sql`
      SELECT * FROM user_pending_actions WHERE user_id = ${userId}
    `;
    return result[0];
  } catch (error) {
    console.error("Error getting user pending action:", error);
    throw error;
  }
}

async function deleteUserPendingAction(userId: number) {
  try {
    await sql`
      DELETE FROM user_pending_actions WHERE user_id = ${userId}
    `;
  } catch (error) {
    console.error("Error deleting user pending action:", error);
    throw error;
  }
}

async function getAllPoints() {
  try {
    const result = await sql`
      SELECT point_id, point_name, latitude, longitude 
      FROM points 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY point_id ASC
    `;
    return result;
  } catch (error) {
    console.error("Error getting all points:", error);
    throw error;
  }
}

function buildRouteUrl(points: Array<{ latitude: string; longitude: string }>) {
  if (points.length < 2) return null;
  const coordinates = points.map((p) => `${p.latitude},${p.longitude}`).join("~");
  return `https://yandex.ru/maps/?mode=routes&rtt=auto&rtext=${coordinates}&utm_source=ymaps_app_redirect`;
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const update: TelegramUpdate = await request.json();

      // --- Обработка ответов операторов ---
    if (update.message && 
        update.message.chat.id.toString() === process.env.SUPPORT_OPERATOR_CHAT_ID &&
        update.message.reply_to_message) {
      
      const message = update.message;
      const operatorId = message.from.id;
      
      const isOp = await isOperator(operatorId);
      if (!isOp) {
        await sendMessage(
          message.chat.id,
          "❌ Только операторы могут отвечать на вопросы",
          { reply_to_message_id: message.message_id }
        );
        return NextResponse.json({ status: "operator_only" });
      }

      // Обрабатываем ответ оператора
      const result = await handleOperatorReply(
        message, 
        update.message.reply_to_message
      );

      if (result) {
        // Добавляем сообщение в историю тикета
        if (result.ticketId && message.text) {
          await addMessageToTicket(
            result.ticketId, 
            operatorId, 
            message.text, 
            true
          );
          
          // Проверяем, хочет ли оператор закрыть тикет
          if (message.text.toLowerCase().includes('/close')) {
            await updateTicketStatus(result.ticketId, 'closed');
            await sendMessage(
              message.chat.id,
              "✅ Диалог завершен. Тикет закрыт.",
              { reply_to_message_id: message.message_id }
            );
          } else {
            await sendMessage(
              message.chat.id,
              "✅ Ответ отправлен пользователю",
              { reply_to_message_id: message.message_id }
            );
          }
        }
      } else {
        await sendMessage(
          message.chat.id,
          "❌ Не удалось обработать ответ",
          { reply_to_message_id: message.message_id }
        );
      }
      
      return NextResponse.json({ status: "support_answer_processed" });
    }

    // --- Обработка callback query ---
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message?.chat.id;
      const messageId = callbackQuery.message?.message_id;
      const userId = callbackQuery.from.id;
      const data = callbackQuery.data;

      if (!chatId) {
        return NextResponse.json({ ok: true, status: "no_chat_id" });
      }

      // Обработка выбора точки маршрута
      if (data?.startsWith("route_point_")) {
        const pointId = data.replace("route_point_", "");

        try {
          const user = await getUserByTelegramId(userId);
          if (!user) throw new Error("User not found");

          const pendingAction = await getUserPendingAction(user.id);
          const pointResult = await sql`
            SELECT point_id, point_name, latitude, longitude 
            FROM points 
            WHERE point_id = ${pointId}
            LIMIT 1
          `;

          if (pointResult.length === 0) throw new Error("Point not found");
          const selectedPoint = pointResult[0];

          let routePoints = [];
          let stepMessage = "";

          if (pendingAction?.action_type === "building_route_start") {
            routePoints = [selectedPoint];
            stepMessage = `✅ Точка отправления: <b>${selectedPoint.point_id} ${selectedPoint.point_name}</b>\n\n🎯 Выберите точку назначения:`;
            await setUserPendingAction(user.id, "building_route_continue", null, { points: routePoints });
          } 
          else if (pendingAction?.action_type === "building_route_continue") {
            const existingData = pendingAction.action_data ? JSON.parse(pendingAction.action_data) : { points: [] };
            routePoints = [...existingData.points, selectedPoint];

            stepMessage = `🗺️ <b>Маршрут строится:</b>\n\n`;
            routePoints.forEach((point, index) => {
              const emoji = index === 0 ? "🚀" : index === routePoints.length - 1 ? "🏁" : "📍";
              stepMessage += `${emoji} ${index + 1}. ${point.point_id} ${point.point_name}\n`;
            });

            stepMessage += `\n💡 Выберите следующую точку или завершите построение маршрута:`;
            await setUserPendingAction(user.id, "building_route_continue", null, { points: routePoints });
          }

          await answerCallbackQuery(callbackQuery.id, `Добавлена точка: ${selectedPoint.point_name}`);
          if (messageId) await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });

          const allPoints = await getAllPoints();
          const selectedPointIds = routePoints.map((p) => p.point_id);
          const availablePoints = allPoints.filter((p) => !selectedPointIds.includes(p.point_id));

          const buttons = [];
          const controlButtons = [];

          if (routePoints.length >= 2) {
            controlButtons.push({
              text: "✅ Завершить построение",
              callback_data: "route_finish",
            });
          }

          controlButtons.push({
            text: "❌ Отменить",
            callback_data: "route_cancel",
          });

          buttons.push(controlButtons);

          for (let i = 0; i < availablePoints.length; i += 2) {
            const row = [];
            row.push({
              text: `${availablePoints[i].point_id} ${availablePoints[i].point_name}`,
              callback_data: `route_point_${availablePoints[i].point_id}`,
            });
            if (i + 1 < availablePoints.length) {
              row.push({
                text: `${availablePoints[i + 1].point_id} ${availablePoints[i + 1].point_name}`,
                callback_data: `route_point_${availablePoints[i + 1].point_id}`,
              });
            }
            buttons.push(row);
          }

          await sendMessageWithButtons(chatId, stepMessage, buttons);
          return NextResponse.json({ ok: true, status: "route_point_selected" });
        } catch (error) {
          console.error("Error processing route point selection:", error);
          await sendMessage(chatId, "❌ Произошла ошибка при выборе точки маршрута.");
          return NextResponse.json({ ok: true, status: "route_point_error" });
        }
      }

      // Обработка завершения маршрута
      if (data === "route_finish") {
        try {
          const user = await getUserByTelegramId(userId);
          if (!user) throw new Error("User not found");

          const pendingAction = await getUserPendingAction(user.id);
          if (!pendingAction || pendingAction.action_type !== "building_route_continue") {
            throw new Error("No route building in progress");
          }

          const routeData = JSON.parse(pendingAction.action_data);
          const routePoints = routeData.points;
          if (routePoints.length < 2) throw new Error("Not enough points for route");

          const routeUrl = buildRouteUrl(routePoints);
          if (!routeUrl) throw new Error("Failed to build route URL");

          let routeMessage = `🗺️ <b>Маршрут построен!</b>\n\n📍 <b>Точки маршрута:</b>\n`;
          routePoints.forEach((point, index) => {
            const emoji = index === 0 ? "🚀" : index === routePoints.length - 1 ? "🏁" : "📍";
            routeMessage += `${emoji} ${index + 1}. ${point.point_id} ${point.point_name}\n`;
          });
          routeMessage += `\n🔗 <a href="${routeUrl}">Открыть маршрут в Яндекс.Картах</a>`;

          await answerCallbackQuery(callbackQuery.id, "Маршрут построен!");
          if (messageId) await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
          await sendMessage(chatId, routeMessage);
          await deleteUserPendingAction(user.id);

          return NextResponse.json({ ok: true, status: "route_finished" });
        } catch (error) {
          console.error("Error finishing route:", error);
          await sendMessage(chatId, "❌ Произошла ошибка при построении маршрута.");
          return NextResponse.json({ ok: true, status: "route_finish_error" });
        }
      }

      // Обработка отмены маршрута
      if (data === "route_cancel") {
        try {
          const user = await getUserByTelegramId(userId);
          if (user) await deleteUserPendingAction(user.id);

          await answerCallbackQuery(callbackQuery.id, "Построение маршрута отменено");
          if (messageId) await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
          await sendMessage(chatId, "❌ Построение маршрута отменено.");

          return NextResponse.json({ ok: true, status: "route_cancelled" });
        } catch (error) {
          console.error("Error cancelling route:", error);
          return NextResponse.json({ ok: true, status: "route_cancel_error" });
        }
      }

      // Обработка выбора автопарка
      if (data?.startsWith("carpark_")) {
        const carpark = data.replace("carpark_", "");

        try {
          await answerCallbackQuery(callbackQuery.id, `Выбран автопарк ${carpark}`);
          if (messageId) await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });

          const user = await updateUserRegistrationStep(userId, "carpark", carpark);
          const completionMessage =
            `🎉 Регистрация завершена!\n\n` +
            `👤 Уважаемый(ая) ${user.first_name}!\n\n` +
            `📱 Телефон: +${user.phone}\n` +
            `👤 ФИО: ${user.full_name}\n` +
            `🏢 Автопарк: ${carpark}\n\n` +
            `🚛 Вы будете получать уведомления о рейсах.`;

          await sendMessage(chatId, completionMessage);
          return NextResponse.json({ ok: true, status: "registration_completed" });
        } catch (error) {
          console.error("Error completing registration:", error);
          await sendMessage(chatId, "❌ Произошла ошибка при завершении регистрации.");
          return NextResponse.json({ ok: true, status: "registration_error" });
        }
      }

      // Обработка подтверждения рейса
      if (data?.startsWith("confirm_")) {
        const messageId = Number.parseInt(data.split("_")[1]);

        try {
          const messageResult = await sql`
            SELECT phone, trip_id, telegram_message_id
            FROM trip_messages 
            WHERE id = ${messageId} OR telegram_id = ${userId}
            LIMIT 1
          `;

          if (messageResult.length === 0) throw new Error("No pending messages found");
          const { phone, trip_id, telegram_message_id } = messageResult[0];

          await sql`
            UPDATE trip_messages 
            SET response_status = 'confirmed', 
                response_at = ${new Date().toISOString()}
            WHERE phone = ${phone} AND trip_id = ${trip_id}
          `;

          await answerCallbackQuery(callbackQuery.id, "Спасибо! Рейс подтвержден!");
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] });
          }

          await sendReplyToMessage(
            chatId, 
            telegram_message_id, 
            "✅ Рейс(ы) подтвержден(ы)\n\nСпасибо за ваш ответ!"
          );

          return NextResponse.json({ ok: true, status: "confirmed_processed" });
        } catch (error) {
          console.error("Error processing confirmation:", error);
          await sendMessage(chatId, "❌ Произошла ошибка при обработке подтверждения.");
          return NextResponse.json({ ok: true, status: "confirmation_error" });
        }
      }

      // Обработка отклонения рейса
      if (data?.startsWith("reject_")) {
        const messageId = Number.parseInt(data.split("_")[1]);

        try {
          const user = await getUserByTelegramId(userId);
          if (!user) throw new Error("User not found");

          await setUserPendingAction(
            user.id, 
            "awaiting_rejection_reason", 
            messageId,
            { 
              chatId, 
              originalMessageId: callbackQuery.message?.message_id 
            }
          );

          await answerCallbackQuery(callbackQuery.id, "Внесите комментарий");
          if (callbackQuery.message?.message_id) {
            await editMessageReplyMarkup(chatId, callbackQuery.message.message_id, { inline_keyboard: [] });
          }

          await sendMessage(chatId, `📝 Пожалуйста, укажите причину отклонения рейса:`);
          return NextResponse.json({ ok: true, status: "awaiting_rejection_reason" });
        } catch (error) {
          console.error("Error processing rejection:", error);
          await sendMessage(chatId, "❌ Произошла ошибка при обработке отклонения.");
          return NextResponse.json({ ok: true, status: "rejection_error" });
        }
      }

      await answerCallbackQuery(callbackQuery.id, "Неизвестная команда");
      return NextResponse.json({ ok: true, status: "callback_ignored" });
    }

        // --- Обработка сообщений ---
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const messageText = message.text;

      const existingUser = await getUserByTelegramId(userId);

      // Обработка команды /ask
      if (messageText === "/ask") {
        if (!existingUser || existingUser.registration_state !== "completed") {
          await sendMessage(chatId, "❌ Для обращения завершите регистрацию: /start");
          return NextResponse.json({ status: "registration_required" });
        }
        if (!existingUser.verified) {
          await sendMessage(chatId, "❌ Ваш аккаунт не верифицирован.");
          return NextResponse.json({ status: "not_verified" });
        }

        // Проверяем активный тикет
        const activeTicket = await getActiveUserTicket(existingUser.id);
        if (activeTicket) {
          await sendMessage(
            chatId,
            "✉️ У вас уже есть активное обращение. Продолжайте диалог в этом чате."
          );
          return NextResponse.json({ status: "ticket_already_open" });
        }

        await setUserPendingAction(existingUser.id, "awaiting_support_question");
        await sendMessage(chatId, "✉️ Введите ваш вопрос для диспетчера:");
        return NextResponse.json({ status: "awaiting_question" });
      }

      // Обработка закрытия чата пользователем
      if (messageText === "/close") {
        const activeTicket = await getActiveUserTicket(existingUser.id);
        if (activeTicket) {
          await updateTicketStatus(activeTicket.id, 'closed');
          await sendMessage(chatId, "✅ Диалог с диспетчером завершен.");
        } else {
          await sendMessage(chatId, "❌ У вас нет активных диалогов.");
        }
        return NextResponse.json({ status: "chat_closed" });
      }

      // Обработка вопроса пользователя
      if (existingUser && messageText) {
        const pendingAction = await getUserPendingAction(existingUser.id);
        
        // Первый вопрос в новом тикете
        if (pendingAction?.action_type === "awaiting_support_question") {
          try {
            // Создаем тикет
            const ticket = await createSupportTicket(existingUser.id,
                userId, // userTelegramId
                messageText,
                message.message_id
              );
            
            // Пересылаем вопрос в поддержку
            await forwardToSupport(
              existingUser.id,
              userId, // userTelegramId
              message,
              messageText,
              ticket.id
            );
            
            await deleteUserPendingAction(existingUser.id);
            await sendMessage(chatId, "✅ Ваш вопрос передан диспетчеру. Ожидайте ответа.");
            
            return NextResponse.json({ status: "question_forwarded" });
          } catch (error) {
            console.error("Error forwarding to support:", error);
            await sendMessage(chatId, "❌ Ошибка при отправке вопроса.");
            return NextResponse.json({ status: "support_error" });
          }
        }
        
        // Продолжение диалога в существующем тикете
        const activeTicket = await getActiveUserTicket(existingUser.id);
        if (activeTicket) {
          try {
            // Пересылаем сообщение в поддержку
            await forwardToSupport(
              existingUser.id,
              userId, // userTelegramId
              message,
              messageText,
              activeTicket.id
            );
            
            // Добавляем сообщение в историю
            await addMessageToTicket(activeTicket.id, existingUser.id, messageText);
            
            await sendMessage(chatId, "✉️ Ваше сообщение передано диспетчеру.");
            return NextResponse.json({ status: "followup_sent" });
          } catch (error) {
            console.error("Error sending followup:", error);
            await sendMessage(chatId, "❌ Ошибка при отправке сообщения.");
            return NextResponse.json({ status: "followup_error" });
          }
        }
      }

      // Обработка причины отклонения рейса
      if (existingUser && messageText) {
        const pendingAction = await getUserPendingAction(existingUser.id);
        
        if (pendingAction?.action_type === "awaiting_rejection_reason") {
          try {
            const actionData = JSON.parse(pendingAction.action_data || "{}");
            const tripMessageId = pendingAction.related_message_id;
            const originalMessageId = actionData.originalMessageId;
            
            if (!tripMessageId) throw new Error("No trip message ID");

            await sql`
              UPDATE trip_messages 
              SET response_status = 'rejected', 
                  response_comment = ${messageText},
                  response_at = ${new Date().toISOString()}
              WHERE id = ${tripMessageId}
            `;

            await deleteUserPendingAction(existingUser.id);

            if (originalMessageId) {
              await sendReplyToMessage(
                chatId,
                originalMessageId,
                `❌ Рейс отклонен.\n\nПричина: ${messageText}`
              );
            } else {
              await sendMessage(chatId, `❌ Рейс отклонен.\n\nПричина: ${messageText}`);
            }

            return NextResponse.json({ ok: true, status: "rejection_reason_processed" });
          } catch (error) {
            console.error("Error processing rejection reason:", error);
            await sendMessage(chatId, "❌ Ошибка при сохранении причины.");
            return NextResponse.json({ ok: true, status: "rejection_reason_error" });
          }
        }
      }

      // Обработка команды /toroute
      if (messageText === "/toroute") {
        try {
          if (existingUser) await deleteUserPendingAction(existingUser.id);

          if (!existingUser || existingUser.registration_state !== "completed") {
            await sendMessage(chatId, "❌ Для использования команды завершите регистрацию: /start");
            return NextResponse.json({ status: "user_not_registered" });
          }
          
          if (!existingUser.verified) {
            await sendMessage(chatId, "❌ Ваш аккаунт не верифицирован.");
            return NextResponse.json({ status: "user_not_verified" });
          }

          const allPoints = await getAllPoints();
          if (allPoints.length < 2) {
            await sendMessage(chatId, "❌ Недостаточно точек для построения маршрута.");
            return NextResponse.json({ status: "insufficient_points" });
          }

          await setUserPendingAction(existingUser.id, "building_route_start", null, { points: [] });

          const buttons = [];
          for (let i = 0; i < allPoints.length; i += 2) {
            const row = [];
            row.push({
              text: `${allPoints[i].point_id} ${allPoints[i].point_name}`,
              callback_data: `route_point_${allPoints[i].point_id}`,
            });
            if (i + 1 < allPoints.length) {
              row.push({
                text: `${allPoints[i + 1].point_id} ${allPoints[i + 1].point_name}`,
                callback_data: `route_point_${allPoints[i + 1].point_id}`,
              });
            }
            buttons.push(row);
          }

          buttons.push([{ text: "❌ Отменить", callback_data: "route_cancel" }]);

          await sendMessageWithButtons(
            chatId,
            `🗺️ <b>Построение маршрута</b>\n\n📍 Выберите точку отправления:`,
            buttons
          );

          return NextResponse.json({ status: "toroute_started" });
        } catch (error) {
          console.error("Error processing /toroute:", error);
          await sendMessage(chatId, "❌ Ошибка при запуске построения маршрута.");
          return NextResponse.json({ status: "toroute_error" });
        }
      }

      // Обработка команды /status
      if (messageText === "/status") {
        try {
          if (!existingUser) {
            await sendMessage(chatId, "❌ Вы не зарегистрированы.\n📱 Для регистрации отправьте /start");
            return NextResponse.json({ status: "user_not_found" });
          }

          let statusMessage = `📊 <b>Ваш статус:</b>\n\n`;
          statusMessage += `👤 <b>Пользователь:</b> ${existingUser.first_name || "Не указано"}\n`;
          statusMessage += `📱 <b>Телефон:</b> +${existingUser.phone}\n`;

          if (existingUser.registration_state === "completed") {
            statusMessage += `✅ <b>Статус:</b> Регистрация завершена\n`;
            statusMessage += `👤 <b>ФИО:</b> ${existingUser.full_name}\n`;
            statusMessage += `🏢 <b>Автопарк:</b> ${existingUser.carpark}\n`;
            statusMessage += `🔒 <b>Верификация:</b> ${existingUser.verified ? "✅" : "❌"}\n\n`;
            statusMessage += `🚛 Вы получаете уведомления о рейсах`;
          } else {
            statusMessage += `⏳ <b>Статус:</b> Регистрация не завершена\n`;
            statusMessage += `📝 <b>Этап:</b> ${existingUser.registration_state}\n\n`;
            statusMessage += `💡 Для завершения отправьте /start`;
          }

          await sendMessage(chatId, statusMessage);
          return NextResponse.json({ status: "status_sent" });
        } catch (error) {
          console.error("Error processing /status:", error);
          await sendMessage(chatId, "❌ Ошибка при получении статуса.");
          return NextResponse.json({ status: "status_error" });
        }
      }

      // Обработка команды /help
      if (messageText === "/help") {
        try {
          let helpMessage = `❓ <b>Справка по боту</b>\n\n`;
          helpMessage += `📋 <b>Доступные команды:</b>\n`;
          helpMessage += `🚀 /start - Начать регистрацию\n`;
          helpMessage += `🗺️ /toroute - Построить маршрут\n`;
          helpMessage += `📊 /status - Проверить статус\n`;
          helpMessage += `❓ /help - Показать справку\n`;
          helpMessage += `✉️ /ask - Задать вопрос диспетчеру\n\n`;
          helpMessage += `🆘 <b>Техподдержка:</b>\nОбратитесь к администратору системы.`;

          await sendMessage(chatId, helpMessage);
          return NextResponse.json({ status: "help_sent" });
        } catch (error) {
          console.error("Error processing /help:", error);
          await sendMessage(chatId, "❌ Ошибка при получении справки.");
          return NextResponse.json({ status: "help_error" });
        }
      }

      // Обработка команды /start
      if (messageText === "/start") {
        try {
          if (existingUser) await deleteUserPendingAction(existingUser.id);

          if (existingUser && existingUser.registration_state === "completed") {
            const message = 
              `👋 Здравствуйте, ${existingUser.first_name}!\n\n` +
              `✅ Вы уже зарегистрированы.\n\n` +
              `💡 Для построения маршрута используйте /toroute`;
            await sendMessage(chatId, message);
            return NextResponse.json({ status: "user_already_registered" });
          }

          await sendMessage(chatId, "🤖 Добро пожаловать в систему уведомлений!");
          await sendContactRequest(chatId);
          return NextResponse.json({ status: "start_processed" });
        } catch (error) {
          console.error("Error processing /start:", error);
          return NextResponse.json({ status: "start_error" });
        }
      }

      // Обработка контакта (номера телефона)
      if (message.contact) {
        try {
          const phone = message.contact.phone_number;
          const name = `${message.contact.first_name} ${message.contact.last_name || ""}`.trim();

          await createUser(userId, phone, name);
          await sendMessage(chatId, "📝 Теперь введите ваше Имя и Отчество (например: Иван Петрович):");
          
          return NextResponse.json({ status: "contact_processed" });
        } catch (error) {
          console.error("Error processing contact:", error);
          await sendMessage(chatId, "❌ Ошибка при регистрации.");
          return NextResponse.json({ status: "contact_error" });
        }
      }

      // Обработка текстовых сообщений в процессе регистрации
      if (messageText) {
        if (!existingUser) {
          await sendMessage(chatId, "👋 Для начала работы отправьте /start");
          return NextResponse.json({ status: "help_sent" });
        }

        // Обработка имени
        if (existingUser.registration_state === "awaiting_first_name") {
          const nameParts = messageText.trim().split(/\s+/);
          if (nameParts.length < 2) {
            await sendMessage(chatId, "❌ Введите Имя и Отчество через пробел (например: Иван Петрович)");
            return NextResponse.json({ status: "invalid_first_name_format" });
          }

          try {
            await updateUserRegistrationStep(userId, "first_name", messageText.trim());
            await sendMessage(chatId, "✅ Теперь введите вашу Фамилию:");
            return NextResponse.json({ status: "first_name_processed" });
          } catch (error) {
            console.error("Error processing first name:", error);
            await sendMessage(chatId, "❌ Ошибка при обработке имени.");
            return NextResponse.json({ status: "first_name_error" });
          }
        }

        // Обработка фамилии
        if (existingUser.registration_state === "awaiting_last_name") {
          const lastName = messageText.trim();
          if (lastName.length < 2) {
            await sendMessage(chatId, "❌ Введите корректную фамилию.");
            return NextResponse.json({ status: "invalid_last_name_format" });
          }

          try {
            await updateUserRegistrationStep(userId, "last_name", lastName);
            
            const buttons = [[
              { text: "🚛 Автопарк 8009", callback_data: "carpark_8009" },
              { text: "🚚 Автопарк 8012", callback_data: "carpark_8012" },
            ]];
            
            await sendMessageWithButtons(
              chatId, 
              "🏢 Выберите ваше автохозяйство:", 
              buttons
            );
            
            return NextResponse.json({ status: "last_name_processed" });
          } catch (error) {
            console.error("Error processing last name:", error);
            await sendMessage(chatId, "❌ Ошибка при обработке фамилии.");
            return NextResponse.json({ status: "last_name_error" });
          }
        }

        // Пользователь уже зарегистрирован
        if (existingUser.registration_state === "completed") {
          await sendMessage(chatId, "ℹ️ Для построения маршрута используйте /toroute");
          return NextResponse.json({ status: "user_already_registered" });
        }

        await sendMessage(chatId, "❓ Неизвестная команда. Используйте /help для справки.");
        return NextResponse.json({ status: "unknown_command" });
      }

      return NextResponse.json({ status: "ignored" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    return NextResponse.json({ status: "error" });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Telegram webhook endpoint",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}
