"use client"

import { useEffect, useRef } from "react"

export function useNotificationChecker() {
  const lastCheckRef = useRef<number>(0)

  useEffect(() => {
    const checkNotifications = async () => {
      const now = Date.now()

      // Проверяем не чаще чем раз в 2 минуты
      if (now - lastCheckRef.current < 120000) {
        return
      }

      try {
        await fetch("/api/notifications/send", {
          method: "GET",
          headers: {
            "x-last-check": lastCheckRef.current.toString(),
          },
        })
        lastCheckRef.current = now
      } catch (error) {
        console.error("Background notification check failed:", error)
      }
    }

    // Проверяем при загрузке страницы
    checkNotifications()

    // Устанавливаем интервал для периодических проверок
    const interval = setInterval(checkNotifications, 120000) // каждые 2 минуты

    return () => clearInterval(interval)
  }, [])
}
