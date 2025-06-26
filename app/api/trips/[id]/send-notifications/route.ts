import { NextResponse } from "next/server"
import { forceSendNotifications } from "@/lib/notification-service"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const tripId = params.id

  try {
    await forceSendNotifications(tripId)
    return NextResponse.json({ message: "Notifications sent successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("Error sending notifications:", error)
    return NextResponse.json({ message: "Failed to send notifications", error: error.message }, { status: 500 })
  }
}
