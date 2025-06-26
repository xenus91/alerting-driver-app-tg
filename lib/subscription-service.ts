// Сервис для автоматической проверки подписок
export class SubscriptionService {
  private static instance: SubscriptionService
  private isChecking = false
  private lastCheck = 0
  private readonly CHECK_INTERVAL = 5 * 60 * 1000 // 5 минут

  private constructor() {}

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService()
    }
    return SubscriptionService.instance
  }

  // Метод для запуска проверки подписок
  async checkSubscriptions(): Promise<void> {
    const now = Date.now()

    // Проверяем не слишком ли часто вызывается
    if (this.isChecking || now - this.lastCheck < this.CHECK_INTERVAL) {
      return
    }

    this.isChecking = true
    this.lastCheck = now

    try {
      console.log("Auto-checking subscriptions...")

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/check-subscriptions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      const data = await response.json()
      if (data.success) {
        console.log(`Subscription check completed: ${data.sent} notifications sent`)
      } else {
        console.error("Subscription check failed:", data.error)
      }
    } catch (error) {
      console.error("Error in auto subscription check:", error)
    } finally {
      this.isChecking = false
    }
  }

  // Метод для принудительной проверки (вызывается при обновлении статуса рассылки)
  async forceCheck(): Promise<void> {
    this.lastCheck = 0 // Сбрасываем ограничение по времени
    await this.checkSubscriptions()
  }
}

// Экспортируем singleton instance
export const subscriptionService = SubscriptionService.getInstance()
