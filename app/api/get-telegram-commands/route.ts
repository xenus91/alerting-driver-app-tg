import { NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function GET() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMyCommands`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to get commands")
    }

    console.log("Current Telegram bot commands:", data.result)

    return NextResponse.json({
      success: true,
      commands: data.result,
      message: "Current Telegram bot commands retrieved successfully",
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
