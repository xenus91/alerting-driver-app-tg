// Файл для совместимости - переэкспортируем функции из database.ts
import {
  updateMessageResponse as dbUpdateMessageResponse,
  getTripMessageByTelegramId as dbGetTripMessageByTelegramId,
} from "./database"
import { checkAndSendNotifications } from "./notification-service"

// Переэкспортируем функции из database.ts
export const updateMessageResponse = dbUpdateMessageResponse
export const getTripMessageByTelegramId = dbGetTripMessageByTelegramId

// Функция для отправки уведомлений подписчикам (алиас для совместимости)
export async function sendSubscriptionNotificationsForTrip(tripId: number) {
  try {
    console.log(`Sending subscription notifications for trip ${tripId}`)
    const result = await checkAndSendNotifications(tripId, true)
    return result
  } catch (error) {
    console.error("Error sending subscription notifications:", error)
    return { success: false, error: "Failed to send notifications" }
  }
}
