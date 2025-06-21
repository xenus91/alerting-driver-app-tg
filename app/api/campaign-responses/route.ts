import { type NextRequest, NextResponse } from "next/server"
import { getCampaignMessages } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get("campaignId")

    if (!campaignId) {
      return NextResponse.json({ error: "ID кампании обязателен" }, { status: 400 })
    }

    const messages = await getCampaignMessages(Number.parseInt(campaignId))

    // Группируем ответы по статусу
    const responses = {
      confirmed: messages.filter((msg) => msg.response_status === "confirmed"),
      rejected: messages.filter((msg) => msg.response_status === "rejected"),
      pending: messages.filter((msg) => msg.response_status === "pending" && msg.status === "sent"),
    }

    const stats = {
      total: messages.length,
      sent: messages.filter((msg) => msg.status === "sent").length,
      confirmed: responses.confirmed.length,
      rejected: responses.rejected.length,
      pending: responses.pending.length,
    }

    return NextResponse.json({
      success: true,
      stats,
      responses,
    })
  } catch (error) {
    console.error("Get campaign responses error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении ответов",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
