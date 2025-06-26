import { checkAndSendNotifications } from "@/lib/notification-service"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    await checkAndSendNotifications()
    return NextResponse.json({ message: "Notifications checked and sent." }, { status: 200 })
  } catch (error) {
    console.error("Error checking and sending notifications:", error)
    return NextResponse.json({ error: "Failed to check and send notifications." }, { status: 500 })
  }
}
