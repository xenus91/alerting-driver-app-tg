import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get("campaignId")

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 })
    }

    // Получаем информацию о текущем пользователе из сессии
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Получаем данные текущего пользователя
    const currentUserResult = await sql`
      SELECT id, role, carpark 
      FROM users 
      WHERE telegram_id = ${Number.parseInt(sessionCookie.value)}
    `

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    const currentUser = currentUserResult[0]

    // Получаем ответы с учетом роли пользователя
    let responsesQuery

    if (currentUser.role === "operator" && currentUser.carpark) {
      // Операторы видят только ответы пользователей из своего автопарка
      responsesQuery = sql`
        SELECT 
          tm.id,
          tm.telegram_message_id,
          tm.sent_at,
          tm.status,
          tm.response_text,
          tm.response_received_at,
          u.name as user_name,
          u.phone as user_phone,
          u.telegram_id as user_telegram_id,
          u.carpark as user_carpark,
          t.id as trip_id
        FROM trip_messages tm
        JOIN trips t ON tm.trip_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE tm.campaign_id = ${campaignId} 
          AND u.carpark = ${currentUser.carpark}
          AND tm.response_text IS NOT NULL
        ORDER BY tm.response_received_at DESC
      `
    } else {
      // Администраторы видят все ответы
      responsesQuery = sql`
        SELECT 
          tm.id,
          tm.telegram_message_id,
          tm.sent_at,
          tm.status,
          tm.response_text,
          tm.response_received_at,
          u.name as user_name,
          u.phone as user_phone,
          u.telegram_id as user_telegram_id,
          u.carpark as user_carpark,
          t.id as trip_id
        FROM trip_messages tm
        JOIN trips t ON tm.trip_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE tm.campaign_id = ${campaignId} 
          AND tm.response_text IS NOT NULL
        ORDER BY tm.response_received_at DESC
      `
    }

    const responses = await responsesQuery

    return NextResponse.json({
      success: true,
      responses: responses,
    })
  } catch (error) {
    console.error("Get campaign responses error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении ответов на кампанию",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export const dynamic = "force-dynamic"
