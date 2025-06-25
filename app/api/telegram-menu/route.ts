import { type NextRequest, NextResponse } from "next/server"
import { setTelegramBotCommands, getTelegramBotCommands } from "@/lib/telegram-menu"

export async function POST(request: NextRequest) {
  try {
    console.log("=== SETTING TELEGRAM BOT MENU ===")

    const result = await setTelegramBotCommands()

    return NextResponse.json({
      success: true,
      message: "Bot commands set successfully",
      commands: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error setting bot menu:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    console.log("=== GETTING TELEGRAM BOT MENU ===")

    const commands = await getTelegramBotCommands()

    return NextResponse.json({
      success: true,
      commands: commands,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting bot menu:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
