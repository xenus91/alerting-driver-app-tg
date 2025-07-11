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
}

export function DispatcherConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  onReject,
  driverName,
  phone,
}: DispatcherConfirmationModalProps) {
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<"confirm" | "reject">("confirm")

  const handleSubmit = async (action: "confirm" | "reject") => {
    setIsLoading(true)
    setActionType(action)
    try {
      if (action === "confirm") {
        await onConfirm(comment)
      } else {
        await onReject(comment)
      }
      setComment("")
      onClose()
    } catch (error) {
      console.error(`Error ${action === "confirm" ? "confirming" : "rejecting"} trip:`, error)
    } finally {
      setIsLoading(false)
    }
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
              Комментарий диспетчера
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Введите комментарий (обязательно)"
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleSubmit("reject")}
              disabled={isLoading || !comment.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading && actionType === "reject" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Отклонить
            </Button>
            <Button
              variant="default"
              onClick={() => handleSubmit("confirm")}
              disabled={isLoading || !comment.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading && actionType === "confirm" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Подтвердить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
