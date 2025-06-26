"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Bell, Clock } from "lucide-react"

interface SubscriptionIntervalModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (intervalMinutes: number) => void
  isLoading?: boolean
}

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 минут", description: "Частые уведомления" },
  { value: 30, label: "30 минут", description: "Рекомендуется" },
  { value: 45, label: "45 минут", description: "Умеренно" },
  { value: 60, label: "1 час", description: "Редко" },
  { value: 90, label: "1.5 часа", description: "Очень редко" },
  { value: 120, label: "2 часа", description: "Минимум уведомлений" },
]

export function SubscriptionIntervalModal({ isOpen, onClose, onConfirm, isLoading }: SubscriptionIntervalModalProps) {
  const [selectedInterval, setSelectedInterval] = useState("30")

  const handleConfirm = () => {
    onConfirm(Number.parseInt(selectedInterval))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Настройка уведомлений
          </DialogTitle>
          <DialogDescription>Выберите как часто вы хотите получать уведомления о прогрессе рассылки</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedInterval} onValueChange={setSelectedInterval}>
            <div className="space-y-3">
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
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Подписка..." : "Подписаться"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
