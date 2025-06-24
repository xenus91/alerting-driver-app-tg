import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = Number.parseInt(params.id)

    if (!tripId) {
      return NextResponse.json({ success: false, error: "Invalid trip ID" }, { status: 400 })
    }

    console.log(`=== DELETING TRIP ${tripId} ===`)

    // Проверяем существование рассылки
    const tripCheck = await sql`
      SELECT id FROM trips WHERE id = ${tripId}
    `

    if (tripCheck.length === 0) {
      return NextResponse.json({ success: false, error: "Trip not found" }, { status: 404 })
    }

    // Проверяем что все сообщения подтверждены или завершены с ошибкой
    const pendingMessages = await sql`
      SELECT COUNT(*) as count 
      FROM trip_messages 
      WHERE trip_id = ${tripId} 
      AND response_status = 'pending' 
      AND status != 'error'
    `

    if (pendingMessages[0].count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete trip with pending messages. All messages must be confirmed or failed.",
        },
        { status: 400 },
      )
    }

    // Удаляем в правильном порядке (сначала зависимые таблицы)

    // 1. Удаляем сообщения
    const deletedMessages = await sql`
      DELETE FROM trip_messages WHERE trip_id = ${tripId}
    `
    console.log(`Deleted ${deletedMessages.length} messages`)

    // 2. Удаляем точки маршрута
    const deletedPoints = await sql`
      DELETE FROM trip_points WHERE trip_id = ${tripId}
    `
    console.log(`Deleted ${deletedPoints.length} trip points`)

    // 3. Удаляем саму рассылку
    const deletedTrip = await sql`
      DELETE FROM trips WHERE id = ${tripId}
    `
    console.log(`Deleted trip ${tripId}`)

    console.log(`=== TRIP ${tripId} DELETED SUCCESSFULLY ===`)

    return NextResponse.json({
      success: true,
      message: "Trip deleted successfully",
      deleted: {
        messages: deletedMessages.length,
        points: deletedPoints.length,
        trip: deletedTrip.length,
      },
    })
  } catch (error) {
    console.error("Error deleting trip:", error)
    return NextResponse.json({ success: false, error: "Failed to delete trip" }, { status: 500 })
  }
}
