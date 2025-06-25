import { NextResponse } from "next/server"
import { setTelegramCommands, deleteTelegramCommands } from "@/lib/telegram-commands"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const forceUpdate = body.force || false

    if (forceUpdate) {
      console.log("🔄 Force update requested - deleting all commands first")
      await deleteTelegramCommands()
      // Небольшая задержка для обеспечения обработки
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    const result = await setTelegramCommands()

    return NextResponse.json({
      success: true,
      message: "Telegram bot commands set successfully",
      result: result,
      force_update: forceUpdate,
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
    options: {
      force: "Set to true to delete all commands first",
    },
    commands: [
      { command: "start", description: "🚀 Начать работу с ботом" },
      { command: "toroute", description: "🗺️ Построить маршрут между точками" },
      { command: "status", description: "📊 Проверить статус регистрации" },
      { command: "help", description: "❓ Получить справку" },
    ],
  })
}
