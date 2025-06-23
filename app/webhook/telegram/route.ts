import { NextResponse } from "next/server"

import type { TelegramWebhookBody } from "@/types/telegram"
import { getUserByTelegramId } from "@/utils/db"

export async function POST(request: Request) {
  const body: TelegramWebhookBody = await request.json()

  if (!body.message) {
    return NextResponse.json({ ok: true })
  }

  const { message } = body

  if (message.text === "/start") {
    // Проверяем, зарегистрирован ли уже пользователь
    const existingUser = await getUserByTelegramId(message.from.id)

    if (existingUser) {
      // Пользователь уже зарегистрирован
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text:
            `👋 Добро пожаловать обратно, ${existingUser.full_name || existingUser.first_name || existingUser.name}!\n\n` +
            `Вы уже зарегистрированы в системе.\n` +
            `📱 Телефон: ${existingUser.phone}\n` +
            `🏢 Автопарк: ${existingUser.carpark || "Не указан"}\n` +
            `✅ Статус: ${existingUser.registration_state === "completed" ? "Регистрация завершена" : "Регистрация не завершена"}`,
        }),
      })
      return NextResponse.json({ ok: true })
    }

    // Если пользователь не зарегистрирован, продолжаем обычную регистрацию
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chat.id,
        text: "Привет! Я бот для регистрации водителей. Пожалуйста, введите ваш номер телефона:",
      }),
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
