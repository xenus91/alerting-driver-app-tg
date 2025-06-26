"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Bell, Clock } from "lucide-react"

interface TripSubscriptionModalProps {
  tripId: number
  isOpen: boolean
  onClose: () => void
  onSubscriptionSaved: (tripId: number, intervalMinutes: number) => void
}

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 минут", description: "Частые уведомления" },
  { value: 30, label: "30 минут", description: "Регулярные уведомления" },
  { value: 45, label: "45 минут", description: "Умеренные уведомления" },
  { value: 60, label: "1 час", description: "Редкие уведомления" },
  { value: 90, label: "1 час 30 минут", description: "Очень редкие уведомления" },
  { value: 120, label: "2 часа", description: "Минимальные уведомления" },
]

export function TripSubscriptionModal({ tripId, isOpen, onClose, onSubscriptionSaved }: TripSubscriptionModalProps) {
  const [selectedInterval, setSelectedInterval] = useState<string>("30")
  const [isSubscribing, setIsSubscribing] = useState(false)

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interval_minutes: Number.parseInt(selectedInterval),
        }),
      })

      const data = await response.json()
      if (data.success) {
        onSubscriptionSaved(tripId, Number.parseInt(selectedInterval))
      } else {
        alert("Ошибка при подписке: " + data.error)
      }
    } catch (error) {
      console.error("Error subscribing:", error)
      alert("Ошибка при подписке")
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Подписка на уведомления
          </DialogTitle>
          <DialogDescription>
            Выберите интервал получения уведомлений о прогрессе рассылки #{tripId}. Вы будете получать сообщения в
            Telegram с информацией о количестве ответов.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Label className="text-sm font-medium">Интервал уведомлений:</Label>
          <RadioGroup value={selectedInterval} onValueChange={setSelectedInterval} className="space-y-3">
            {INTERVAL_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <RadioGroupItem value={option.value.toString()} id={`interval-${option.value}`} />
                <Label htmlFor={`interval-${option.value}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <span className="text-sm text-gray-500">{option.description}</span>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Что вы будете получать:</strong>
            <ul className="mt-1 space-y-1 text-xs">
              <li>• Процент получения ответов</li>
              <li>• Количество подтверждений и отклонений</li>
              <li>• Общий прогресс рассылки</li>
              <li>• Автоматическая отписка при завершении</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubscribing}>
            Отмена
          </Button>
          <Button onClick={handleSubscribe} disabled={isSubscribing} className="bg-blue-600 hover:bg-blue-700">
            <Bell className="h-4 w-4 mr-2" />
            {isSubscribing ? "Подписываемся..." : "Подписаться"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
