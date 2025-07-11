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
  const [actionType, setActionType] = useState<"confirm" | "reject" | null>(null)

  const handleSubmit = async () => {
    if (!actionType) return

    setIsLoading(true)
    try {
      if (actionType === "confirm") {
        await onConfirm(comment)
      } else {
        await onReject(comment)
      }
      setComment("")
      setActionType(null)
      onClose()
    } catch (error) {
      console.error(`Error ${actionType} trip:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {actionType === "confirm"
              ? "Подтверждение рейса"
              : actionType === "reject"
              ? "Отклонение рейса"
              : "Выберите действие"}
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

          {!actionType && (
            <div className="flex flex-col gap-3 pt-4">
              <Button
                variant="default"
                onClick={() => setActionType("confirm")}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Подтвердить
              </Button>

              <Button
                variant="destructive"
                onClick={() => setActionType("reject")}
                className="bg-red-600 hover:bg-red-700"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Отклонить
              </Button>
            </div>
          )}

          {actionType && (
            <div className="space-y-4">
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
                <Button variant="outline" onClick={() => setActionType(null)} disabled={isLoading}>
                  Назад
                </Button>
                <Button
                  variant={actionType === "confirm" ? "default" : "destructive"}
                  onClick={handleSubmit}
                  disabled={isLoading || !comment.trim()}
                  className={
                    actionType === "confirm"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {actionType === "confirm" ? "Подтверждение..." : "Отклонение..."}
                    </>
                  ) : (
                    <>
                      {actionType === "confirm" ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      {actionType === "confirm" ? "Подтвердить" : "Отклонить"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
