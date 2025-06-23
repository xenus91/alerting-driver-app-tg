import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import {
  sendMessage,
  sendContactRequest,
  answerCallbackQuery,
  editMessageReplyMarkup,
  type TelegramUpdate,
} from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    console.log("Received Telegram update:", JSON.stringify(update, null, 2))

    // Обработка обычных сообщений
    if (update.message) {
      const message = update.message
      const chatId = message.chat.id
      const userId = message.from.id
      const text = message.text

      console.log(`Processing message from user ${userId}: ${text}`)

      // Команда /start
      if (text === "/start") {
        // Проверяем, зарегистрирован ли уже пользователь
        const existingUserResult = await sql`
          SELECT * FROM users WHERE telegram_user_id = ${userId}
        `

        if (existingUserResult.rows.length > 0) {
          const user = existingUserResult.rows[0]
          await sendMessage(
            chatId,
            `Вы уже зарегистрированы в системе!\n\n` +
              `👤 Имя: ${user.first_name || "Не указано"}\n` +
              `📱 Телефон: ${user.phone || "Не указан"}\n` +
              `🚗 Автопарк: ${user.carpark || "Не указан"}\n` +
              `✅ Статус: ${user.registration_state || "completed"}`,
          )
          return NextResponse.json({ ok: true })
        }

        // Если не зарегистрирован, запрашиваем контакт
        await sendContactRequest(chatId)
        return NextResponse.json({ ok: true })
      }

      // Обработка контакта
      if (message.contact) {
        const contact = message.contact
        const phoneNumber = contact.phone_number.replace(/^\+/, "") // Убираем + в начале

        console.log(`Processing contact: ${phoneNumber}`)

        try {
          // Проверяем, есть ли пользователь с таким номером
          const existingUserResult = await sql`
            SELECT * FROM users WHERE phone = ${phoneNumber}
          `

          if (existingUserResult.rows.length > 0) {
            // Обновляем существующего пользователя
            await sql`
              UPDATE users 
              SET telegram_user_id = ${userId}, 
                  telegram_chat_id = ${chatId},
                  first_name = ${contact.first_name},
                  last_name = ${contact.last_name || null},
                  registration_state = 'completed'
              WHERE phone = ${phoneNumber}
            `

            await sendMessage(
              chatId,
              `✅ Регистрация завершена!\n\n` +
                `Ваш номер телефона ${phoneNumber} успешно привязан к Telegram аккаунту.\n` +
                `Теперь вы будете получать уведомления о рейсах.`,
            )
          } else {
            // Создаем нового пользователя
            await sql`
              INSERT INTO users (
                phone, 
                telegram_user_id, 
                telegram_chat_id, 
                first_name, 
                last_name, 
                registration_state,
                role
              ) VALUES (
                ${phoneNumber}, 
                ${userId}, 
                ${chatId}, 
                ${contact.first_name}, 
                ${contact.last_name || null}, 
                'completed',
                'driver'
              )
            `

            await sendMessage(
              chatId,
              `✅ Регистрация завершена!\n\n` +
                `Добро пожаловать! Ваш номер телефона ${phoneNumber} зарегистрирован в системе.\n` +
                `Теперь вы будете получать уведомления о рейсах.`,
            )
          }
        } catch (error) {
          console.error("Database error:", error)
          await sendMessage(chatId, "❌ Произошла ошибка при регистрации. Попробуйте позже.")
        }

        return NextResponse.json({ ok: true })
      }
    }

    // Обработка callback запросов (нажатие кнопок)
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const messageId = callbackQuery.message?.message_id
      const data = callbackQuery.data

      console.log(`Processing callback query: ${data}`)

      if (data?.startsWith("confirm_") || data?.startsWith("reject_")) {
        const action = data.startsWith("confirm_") ? "confirmed" : "rejected"
        const tripMessageId = data.split("_")[1]

        try {
          // Обновляем статус сообщения в базе данных
          await sql`
            UPDATE trip_messages 
            SET response = ${action}, response_time = NOW() 
            WHERE id = ${tripMessageId}
          `

          // Удаляем кнопки из сообщения
          if (chatId && messageId) {
            await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] })
          }

          // Отправляем подтверждение
          const responseText = action === "confirmed" ? "✅ Рейс подтвержден!" : "❌ Рейс отклонен!"
          await answerCallbackQuery(callbackQuery.id, responseText)

          console.log(`Trip message ${tripMessageId} ${action}`)
        } catch (error) {
          console.error("Error processing callback:", error)
          await answerCallbackQuery(callbackQuery.id, "Произошла ошибка")
        }
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
