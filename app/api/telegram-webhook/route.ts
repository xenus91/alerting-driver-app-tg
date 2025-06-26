import { checkAndSendNotifications } from "@/lib/notification-service"

// This is a placeholder for the actual route handler.
// Replace this with your actual implementation.
export async function POST(request: Request) {
  try {
    const data = await request.json()
    console.log("Received Telegram webhook data:", data)

    // Example: Handling a callback query
    if (data.callback_query) {
      const callbackQuery = data.callback_query
      const messageId = callbackQuery.message.message_id
      const chatId = callbackQuery.message.chat.id
      const callbackData = callbackQuery.data

      // Assuming callbackData contains responseStatus and responseComment
      const [responseStatus, responseComment] = callbackData.split(":")
      const trip_id = callbackQuery?.message?.reply_to_message?.text?.split("ID: ")[1]?.split("\n")[0]

      // Placeholder for updateMessageResponse function
      async function updateMessageResponse(messageId: number, responseStatus: string, responseComment: string) {
        // Simulate updating the message and returning some data
        console.log(`Updating message ${messageId} with status ${responseStatus} and comment ${responseComment}`)
        if (responseStatus === "confirmed") {
          console.log("=== CONFIRMATION PROCESSED ===")
          // Отправляем уведомления подписчикам
          try {
            if (trip_id) {
              await checkAndSendNotifications(Number(trip_id), true)
            }
          } catch (error) {
            console.error("Error sending subscription notifications:", error)
          }
        } else {
          console.log("=== REJECTION REASON PROCESSED ===")
          // Отправляем уведомления подписчикам
          try {
            if (trip_id) {
              await checkAndSendNotifications(Number(trip_id), true)
            }
          } catch (error) {
            console.error("Error sending subscription notifications:", error)
          }
        }
        return { trip_id: trip_id, message_id: messageId, status: responseStatus, comment: responseComment }
      }

      const updatedMessage = await updateMessageResponse(messageId, responseStatus, responseComment)

      // Отправляем уведомления подписчикам (если есть)
      if (updatedMessage) {
        try {
          await checkAndSendNotifications(Number(updatedMessage.trip_id), true)
        } catch (error) {
          console.error("Error sending subscription notifications:", error)
        }
      }

      // Placeholder for sending an acknowledgement to Telegram
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    // Handle other types of updates here (e.g., new messages)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error processing Telegram webhook:", error)
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}
