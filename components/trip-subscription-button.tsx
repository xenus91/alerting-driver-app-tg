"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SubscriptionIntervalModal } from "./subscription-interval-modal"

interface TripSubscriptionButtonProps {
  tripId: number
  userTelegramId?: number
  className?: string
}

export function TripSubscriptionButton({ tripId, userTelegramId, className }: TripSubscriptionButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const [showIntervalModal, setShowIntervalModal] = useState(false)

  // Проверяем подписку при загрузке
  useEffect(() => {
    if (!userTelegramId) return

    const checkSubscription = async () => {
      try {
        const response = await fetch(`/api/trip-subscriptions?user_telegram_id=${userTelegramId}&trip_id=${tripId}`)
        const data = await response.json()

        if (data.success && data.subscriptions.length > 0) {
          setIsSubscribed(true)
        }
      } catch (error) {
        console.error("Error checking subscription:", error)
      }
    }

    checkSubscription()
  }, [tripId, userTelegramId])

  const handleSubscriptionToggle = async () => {
    if (!userTelegramId) {
      toast({
        title: "Ошибка",
        description: "Необходимо войти через Telegram для подписки на уведомления",
        variant: "destructive",
      })
      return
    }

    if (isSubscribed) {
      // Отписываемся
      setIsLoading(true)
      try {
        const response = await fetch(`/api/trip-subscriptions?trip_id=${tripId}&user_telegram_id=${userTelegramId}`, {
          method: "DELETE",
        })

        const data = await response.json()
        if (data.success) {
          setIsSubscribed(false)
          toast({
            title: "Отписка успешна",
            description: "Вы больше не будете получать уведомления о прогрессе этой рассылки",
          })
        } else {
          throw new Error(data.error)
        }
      } catch (error) {
        console.error("Error unsubscribing:", error)
        toast({
          title: "Ошибка",
          description: error instanceof Error ? error.message : "Не удалось отписаться",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    } else {
      // Показываем модальное окно для выбора интервала
      setShowIntervalModal(true)
    }
  }

  const handleConfirmSubscription = async (intervalMinutes: number) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/trip-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trip_id: tripId,
          user_telegram_id: userTelegramId,
          interval_minutes: intervalMinutes,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setIsSubscribed(true)
        setShowIntervalModal(false)
        toast({
          title: "Подписка активна",
          description: `Вы будете получать уведомления о прогрессе рассылки каждые ${intervalMinutes} минут`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error subscribing:", error)
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось создать подписку",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!userTelegramId) {
    return null // Не показываем кнопку если пользователь не авторизован через Telegram
  }

  return (
    <>
      <Button
        variant={isSubscribed ? "default" : "outline"}
        size="sm"
        onClick={handleSubscriptionToggle}
        disabled={isLoading}
        className={className}
      >
        {isSubscribed ? (
          <>
            <Bell className="h-4 w-4 mr-2" />
            {isLoading ? "Отписка..." : "Подписан"}
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4 mr-2" />
            {isLoading ? "Подписка..." : "Подписаться"}
          </>
        )}
      </Button>
      <SubscriptionIntervalModal
        isOpen={showIntervalModal}
        onClose={() => setShowIntervalModal(false)}
        onConfirm={handleConfirmSubscription}
        isLoading={isLoading}
      />
    </>
  )
}
