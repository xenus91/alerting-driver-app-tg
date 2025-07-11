// components/dispatcher-confirmation-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface DispatcherConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (comment: string) => Promise<void>
  onReject: (comment: string) => Promise<void>
  driverName: string
  phone: string
  initialAction?: "confirm" | "reject" // Добавляем параметр для начального действия
}

export function DispatcherConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  onReject,
  driverName,
  phone,
  initialAction = "confirm", // Значение по умолчанию
}: DispatcherConfirmationModalProps) {
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<"confirm" | "reject">(initialAction)

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      if (actionType === "confirm") {
        await onConfirm(comment)
      } else {
        await onReject(comment)
      }
      setComment("")
      onClose()
    } catch (error) {
      console.error(`Error ${actionType === "confirm" ? "confirming" : "rejecting"} trip:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const switchActionType = () => {
    setActionType(actionType === "confirm" ? "reject" : "confirm")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {actionType === "confirm" ? "Подтверждение рейса" : "Отклонение рейса"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Водитель: <span className="font-medium">{driverName}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Телефон: <span className="font-medium">{phone}</span>
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="comment" className="block text-sm font-medium">
              {actionType === "confirm" 
                ? "Комментарий диспетчера (необязательно)" 
                : "Причина отклонения (обязательно)"}
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                actionType === "confirm" 
                  ? "Введите комментарий (необязательно)" 
                  : "Укажите причину отклонения (обязательно)"
              }
              className="min-h-[100px]"
            />
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button
              variant="outline"
              onClick={switchActionType}
              disabled={isLoading}
              className="w-full"
            >
              {actionType === "confirm" 
                ? "Перейти к отклонению рейса" 
                : "Перейти к подтверждению рейса"}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Отмена
              </Button>
              
              {actionType === "confirm" ? (
                <Button
                  variant="default"
                  onClick={handleSubmit}
                  disabled={isLoading || (actionType === "reject" && !comment.trim())}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Подтвердить
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={isLoading || !comment.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Отклонить
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
