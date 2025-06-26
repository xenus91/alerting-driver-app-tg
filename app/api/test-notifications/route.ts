import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Вызываем наш cron endpoint для тестирования
    const cronUrl = new URL("/api/cron/send-notifications", request.url)

    const response = await fetch(cronUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || "test-secret"}`,
      },
    })

    const data = await response.json()

    return NextResponse.json({
      success: true,
      cronResponse: data,
    })
  } catch (error) {
    console.error("Error testing notifications:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
