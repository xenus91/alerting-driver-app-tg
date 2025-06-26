import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию cron job (Vercel передает специальный заголовок)
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Вызываем API для отправки уведомлений
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/send-subscription-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: "Cron job executed successfully",
      result: data,
    })
  } catch (error) {
    console.error("Cron job error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed" }, { status: 500 })
  }
}
