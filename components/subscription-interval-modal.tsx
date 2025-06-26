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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Clock } from "lucide-react"

interface SubscriptionIntervalModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (intervalMinutes: number) => void
  isLoading?: boolean
}

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 минут", description: "Частые уведомления" },
  { value: 30, label: "30 минут", description: "Рекомендуемый интервал" },
  { value: 45, label: "45 минут", description: "" },
  { value: 60, label: "1 час", description: "Умеренные уведомления" },
  { value: 75, label: "1 час 15 минут", description: "" },
  { value: 90, label: "1 час 30 минут", description: "" },
  { value: 105, label: "1 час 45 минут", description: "" },
  { value: 120, label: "2 часа", description: "Редкие уведомления" },
]

export function SubscriptionIntervalModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: SubscriptionIntervalModalProps) {
  const [selectedInterval, setSelectedInterval] = useState<string>("30")

  const handleConfirm = () => {
    onConfirm(Number.parseInt(selectedInterval))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Настройка подписки
          </DialogTitle>
          <DialogDescription>Выберите как часто вы хотите получать уведомления о прогрессе рассылки</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedInterval} onValueChange={setSelectedInterval}>
            <div className="space-y-3">
              {INTERVAL_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value.toString()} id={`interval-${option.value}`} />
                  <Label htmlFor={`interval-${option.value}`} className="flex-1 cursor-pointer flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    {option.description && <span className="text-sm text-muted-foreground">{option.description}</span>}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="flex gap-2">
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
