// components/dispatch-confirm-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface DispatchConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (comment: string) => Promise<void>
  phone: string
  driverName: string
}

export function DispatchConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  phone,
  driverName,
}: DispatchConfirmModalProps) {
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm(comment)
      setComment("")
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подтверждение рейса</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Водитель</Label>
            <Input value={driverName} disabled />
          </div>
          
          <div>
            <Label>Телефон</Label>
            <Input value={phone} disabled />
          </div>
          
          <div>
            <Label>Комментарий диспетчера</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Введите комментарий для водителя (необязательно)"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Подтверждение..." : "Подтвердить рейс"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
