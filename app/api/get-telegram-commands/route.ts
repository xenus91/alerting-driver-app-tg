import { NextResponse } from "next/server"
import { getAllTelegramCommands } from "@/lib/telegram-commands"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function GET() {
  try {
    // Получаем команды для всех областей
    const allCommands = await getAllTelegramCommands()

    // Также получаем команды по умолчанию (старый способ)
    const response = await fetch(`${TELEGRAM_API_URL}/getMyCommands`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()

    return NextResponse.json({
      success: true,
      commands: data.result || [],
      all_scopes: allCommands,
      message: "Telegram bot commands retrieved successfully",
    })
  } catch (error) {
    console.error("Error getting Telegram commands:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
