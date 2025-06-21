import { NextResponse } from "next/server"
import { getTripMessages } from "@/lib/database"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)
    const messages = await getTripMessages(tripId)
    return NextResponse.json({ success: true, messages })
  } catch (error) {
    console.error("Get trip messages error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении сообщений рассылки",
      },
      { status: 500 },
    )
  }
}
