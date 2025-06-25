export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Получаем общую статистику
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM trips) as total_trips,
        (SELECT COUNT(*) FROM trip_messages) as total_messages,
        (SELECT COUNT(*) FROM trip_messages WHERE status = 'sent') as sent_messages,
        (SELECT COUNT(*) FROM trip_messages WHERE response_status = 'confirmed') as confirmed_responses,
        (SELECT COUNT(*) FROM trip_messages WHERE response_status = 'rejected') as rejected_responses,
        (SELECT COUNT(*) FROM trip_messages WHERE response_status = 'pending' AND status = 'sent') as pending_responses,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE) as today_registrations,
        (SELECT COUNT(*) FROM trips WHERE DATE(created_at) = CURRENT_DATE) as today_trips
    `

    return NextResponse.json({
      success: true,
      stats: stats[0],
    })
  } catch (error) {
    console.error("Get stats error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении статистики",
      },
      { status: 500 },
    )
  }
}
