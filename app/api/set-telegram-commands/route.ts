import { NextResponse } from "next/server"
import { setTelegramCommands } from "@/lib/telegram-commands"

export async function POST() {
  try {
    const result = await setTelegramCommands()

    return NextResponse.json({
      success: true,
      message: "Telegram bot commands set successfully",
      result: result,
    })
  } catch (error) {
    console.error("Error setting Telegram commands:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to set Telegram bot commands",
    commands: [
      { command: "start", description: "🚀 Начать работу с ботом" },
      { command: "toroute", description: "🗺️ Построить маршрут между точками" },
      { command: "status", description: "📊 Проверить статус регистрации" },
      { command: "help", description: "❓ Получить справку" },
    ],
  })
}
