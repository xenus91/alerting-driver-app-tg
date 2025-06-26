"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Send, Clock } from "lucide-react"
import { toast } from "sonner"

interface NotificationStats {
  sent: number
  errors: number
  total: number
  message: string
}

export function NotificationsManager() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastStats, setLastStats] = useState<NotificationStats | null>(null)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const sendNotifications = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        setLastStats(data)
        setLastRun(new Date())
        toast.success(data.message || "Уведомления отправлены успешно")
      } else {
        toast.error("Ошибка при отправке уведомлений")
      }
    } catch (error) {
      console.error("Error sending notifications:", error)
      toast.error("Ошибка при отправке уведомлений")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Управление уведомлениями
        </CardTitle>
        <CardDescription>Отправка уведомлений подписчикам о статусе рассылок</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={sendNotifications} disabled={isLoading} className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {isLoading ? "Отправка..." : "Отправить уведомления"}
          </Button>

          {lastRun && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Последний запуск: {lastRun.toLocaleTimeString()}
            </div>
          )}
        </div>

        {lastStats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{lastStats.sent}</div>
              <div className="text-sm text-muted-foreground">Отправлено</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{lastStats.errors}</div>
              <div className="text-sm text-muted-foreground">Ошибок</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{lastStats.total}</div>
              <div className="text-sm text-muted-foreground">Всего проверено</div>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Как это работает:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Система проверяет активные подписки</li>
            <li>• Отправляет уведомления согласно выбранному интервалу</li>
            <li>• Уведомления отправляются только для рассылок с ожидающими ответами</li>
            <li>• Можно запускать вручную или настроить автоматический запуск</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
