// components/dispatcher-cancellation-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, XCircle } from "lucide-react"

interface DispatcherCancellationModalProps {
  isOpen: boolean
  onClose: () => void
  onCancel: (comment: string) => Promise<void>
  driverName: string
  phone: string
}

export function DispatcherCancellationModal({
  isOpen,
  onClose,
  onCancel,
  driverName,
  phone,
}: DispatcherCancellationModalProps) {
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!comment.trim()) {
      alert("Пожалуйста, укажите причину отмены")
      return
    }
    
    setIsLoading(true)
    try {
      await onCancel(comment)
      setComment("")
      onClose()
    } catch (error) {
      console.error("Error canceling trip:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center">Отмена рейса</DialogTitle>
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
            <label htmlFor="comment" className="block text-sm font-medium text-red-600">
              Причина отмены (обязательно)
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Укажите причину отмены"
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={isLoading || !comment.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Отменить рейс
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
