import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Получаем общую статистику
    const [userStats] = await sql`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_registrations
      FROM users
    `

    const [campaignStats] = await sql`
      SELECT 
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_campaigns
      FROM campaigns
    `

    const [messageStats] = await sql`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN response_status = 'confirmed' THEN 1 END) as confirmed_responses,
        COUNT(CASE WHEN response_status = 'rejected' THEN 1 END) as rejected_responses,
        COUNT(CASE WHEN response_status = 'pending' AND status = 'sent' THEN 1 END) as pending_responses
      FROM campaign_messages
    `

    const stats = {
      totalUsers: Number.parseInt(userStats.total_users) || 0,
      totalCampaigns: Number.parseInt(campaignStats.total_campaigns) || 0,
      totalMessages: Number.parseInt(messageStats.total_messages) || 0,
      sentMessages: Number.parseInt(messageStats.sent_messages) || 0,
      confirmedResponses: Number.parseInt(messageStats.confirmed_responses) || 0,
      rejectedResponses: Number.parseInt(messageStats.rejected_responses) || 0,
      pendingResponses: Number.parseInt(messageStats.pending_responses) || 0,
      todayRegistrations: Number.parseInt(userStats.today_registrations) || 0,
      todayCampaigns: Number.parseInt(campaignStats.today_campaigns) || 0,
    }

    return NextResponse.json({
      success: true,
      stats: stats,
    })
  } catch (error) {
    console.error("Get stats error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении статистики",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
