"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Bell, Star } from "lucide-react"
import { toast } from "sonner"

interface SubscriptionIntervalModalProps {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (intervalMinutes: number) => void
  tripTitle?: string
}

const INTERVAL_OPTIONS = [
  { minutes: 15, label: "15 минут", description: "Частые уведомления", icon: "🔥" },
  { minutes: 30, label: "30 минут", description: "Рекомендуемый интервал", icon: "⭐", recommended: true },
  { minutes: 45, label: "45 минут", description: "Умеренные уведомления", icon: "📊" },
  { minutes: 60, label: "1 час", description: "Редкие уведомления", icon: "⏰" },
  { minutes: 75, label: "1 час 15 минут", description: "Очень редкие", icon: "📱" },
  { minutes: 90, label: "1 час 30 минут", description: "Минимальные уведомления", icon: "🔕" },
  { minutes: 105, label: "1 час 45 минут", description: "Почти без уведомлений", icon: "💤" },
  { minutes: 120, label: "2 часа", description: "Максимальный интервал", icon: "🌙" },
]

export function SubscriptionIntervalModal({ isOpen, onClose, onSubscribe, tripTitle }: SubscriptionIntervalModalProps) {
  const [selectedInterval, setSelectedInterval] = useState(30)

  const handleSubscribe = () => {
    onSubscribe(selectedInterval)
    const selectedOption = INTERVAL_OPTIONS.find((opt) => opt.minutes === selectedInterval)
    toast.success(`Подписка создана с интервалом ${selectedOption?.label}`)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Настройка уведомлений
          </DialogTitle>
          {tripTitle && <p className="text-sm text-muted-foreground">Рассылка: {tripTitle}</p>}
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Выберите как часто получать уведомления о прогрессе рассылки:</p>

          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.minutes}
                onClick={() => setSelectedInterval(option.minutes)}
                className={`p-3 rounded-lg border text-left transition-all hover:bg-accent ${
                  selectedInterval === option.minutes ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{option.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {option.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Рекомендуемый
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  {selectedInterval === option.minutes && (
                    <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Предварительный просмотр:</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Вы будете получать уведомления каждые{" "}
              <span className="font-medium">
                {INTERVAL_OPTIONS.find((opt) => opt.minutes === selectedInterval)?.label}
              </span>{" "}
              с информацией о прогрессе рассылки
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubscribe}>Подписаться</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SubscriptionIntervalModal
