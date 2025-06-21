import { NextResponse } from "next/server"
import { getCampaigns } from "@/lib/database"

export async function GET() {
  try {
    const campaigns = await getCampaigns()
    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error("Get campaigns error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении кампаний",
      },
      { status: 500 },
    )
  }
}
