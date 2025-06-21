import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "Webhook endpoint доступен",
    timestamp: new Date().toISOString(),
    url: "/api/webhook",
    methods: ["POST"],
    description: "Этот endpoint принимает webhook запросы от Telegram",
  })
}
