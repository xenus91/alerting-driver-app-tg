import { NextResponse } from "next/server"
import { deleteTelegramCommands } from "@/lib/telegram-commands"

export async function POST() {
  try {
    const result = await deleteTelegramCommands()

    return NextResponse.json({
      success: true,
      message: "All Telegram bot commands deleted successfully",
      result: result,
    })
  } catch (error) {
    console.error("Error deleting Telegram commands:", error)

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
    message: "Use POST to delete all Telegram bot commands",
  })
}
