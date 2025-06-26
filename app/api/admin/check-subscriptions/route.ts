import { type NextRequest, NextResponse } from "next/server"
import { subscriptionService } from "@/lib/subscription-service"

export async function POST(request: NextRequest) {
  try {
    await subscriptionService.forceCheck()
    return NextResponse.json({ success: true, message: "Subscription check triggered" })
  } catch (error) {
    console.error("Error triggering subscription check:", error)
    return NextResponse.json({ success: false, error: "Failed to check subscriptions" }, { status: 500 })
  }
}
