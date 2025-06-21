import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`=== WEBHOOK DEBUG RECEIVED at ${timestamp} ===`)

  try {
    const body = await request.text()
    console.log("Raw webhook body:", body)

    const update = JSON.parse(body)
    console.log("Parsed update:", JSON.stringify(update, null, 2))

    // Проверяем тип обновления
    if (update.callback_query) {
      console.log("🔘 CALLBACK QUERY DETECTED!")
      console.log("Callback data:", update.callback_query.data)
      console.log("User ID:", update.callback_query.from.id)
      console.log("Message ID:", update.callback_query.message?.message_id)
    }

    if (update.message) {
      console.log("💬 MESSAGE DETECTED!")
      console.log("Text:", update.message.text)
      console.log("User ID:", update.message.from.id)
    }

    return NextResponse.json({
      ok: true,
      received_at: timestamp,
      update_type: update.callback_query ? "callback_query" : update.message ? "message" : "other",
      debug: true,
    })
  } catch (error) {
    console.error("Debug webhook error:", error)
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp,
    })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Debug webhook endpoint is working",
    timestamp: new Date().toISOString(),
  })
}
