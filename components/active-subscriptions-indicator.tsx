"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Bell } from "lucide-react"

interface ActiveSubscriptionsIndicatorProps {
  userTelegramId?: number
}

export function ActiveSubscriptionsIndicator({ userTelegramId }: ActiveSubscriptionsIndicatorProps) {
  const [subscriptionsCount, setSubscriptionsCount] = useState(0)

  useEffect(() => {
    if (!userTelegramId) return

    const fetchSubscriptions = async () => {
      try {
        const response = await fetch(`/api/trip-subscriptions?user_telegram_id=${userTelegramId}`)
        const data = await response.json()

        if (data.success) {
          setSubscriptionsCount(data.subscriptions.length)
        }
      } catch (error) {
        console.error("Error fetching subscriptions:", error)
      }
    }

    fetchSubscriptions()
  }, [userTelegramId])

  if (!userTelegramId || subscriptionsCount === 0) {
    return null
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Bell className="h-3 w-3" />
      {subscriptionsCount} активных подписок
    </Badge>
  )
}
