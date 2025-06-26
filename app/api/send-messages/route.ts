import { NextResponse } from "next/server"
import { subscriptionService } from "@/lib/subscription-service"

export async function POST(request: Request) {
  // Placeholder for message sending logic
  console.log("Received a request to send messages.")

  // Simulate sending messages
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log("Messages sent (simulated).")

  // Автоматически проверяем подписки после отправки сообщений
  try {
    await subscriptionService.checkSubscriptions()
  } catch (error) {
    console.error("Error checking subscriptions after message send:", error)
  }

  return NextResponse.json({ message: "Messages sent successfully!" })
}
