"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, Users } from "lucide-react"

interface NotificationPreviewProps {
  intervalMinutes: number
}

export function NotificationPreview({ intervalMinutes }: NotificationPreviewProps) {
  const intervalLabel =
    intervalMinutes === 60
      ? "1 час"
      : intervalMinutes === 120
        ? "2 часа"
        : intervalMinutes < 60
          ? `${intervalMinutes} мин`
          : `${Math.floor(intervalMinutes / 60)} ч ${intervalMinutes % 60} мин`

  return (
    <Card className="bg-gray-50 border-dashed">
      <CardContent className="p-3">
        <div className="text-xs text-gray-600 mb-2">Пример уведомления:</div>

        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-medium text-sm">Прогресс рассылки</div>
              <div className="text-xs text-gray-500">Обновление каждые {intervalLabel}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Прогресс:</span>
              <Badge variant="secondary">67% (8/12)</Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>5 ✓</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>3 ✗</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                <span>4 ⏳</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
