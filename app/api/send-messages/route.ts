import { sendMultipleTripMessageWithButtons } from "@/lib/telegram"
import { groupTripsByPhoneOnly } from "@/lib/excel"

// Function to handle sending messages
export async function sendMessages(req, res) {
  try {
    const trips = await getTrips() // Assume this function fetches trips
    const groupedTrips = groupTripsByPhoneOnly(trips)

    for (const [phone, trips] of Object.entries(groupedTrips)) {
      await sendMultipleTripMessageWithButtons(phone, trips)
    }

    res.status(200).json({ message: "Messages sent successfully" })
  } catch (error) {
    console.error("Error sending messages:", error)
    res.status(500).json({ error: "Failed to send messages" })
  }
}
</merged_code>
