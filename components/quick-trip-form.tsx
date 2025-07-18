"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TripCorrectionModal } from "@/components/trip-correction-modal"
import { Plus } from "lucide-react"

interface QuickTripFormProps {
  isOpen: boolean
  onClose: () => void
  onTripSent: () => void
}

export function QuickTripForm({ isOpen, onClose, onTripSent }: QuickTripFormProps) {
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [conflictTripId, setConflictTripId] = useState<number | null>(null);
  
  const handleClose = () => {
    onClose();
    setCorrectionModalOpen(false);
    setConflictTripId(null);
  };

  const handleConflictTrip = (tripId: number) => {
    setConflictTripId(tripId);
    setCorrectionModalOpen(false); // Закрываем модалку создания
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Быстрая рассылка рейса</DialogTitle>
          </DialogHeader>
          
          <div className="text-center p-6">
            <Button 
              size="lg"
              onClick={() => setCorrectionModalOpen(true)}
            >
              <Plus className="mr-2" />
              Создать новые рейсы
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Модалка для создания новых рейсов */}
      <TripCorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        mode="create"
        onAssignmentSent={() => {
          onTripSent();
          handleClose();
        }}
        onOpenConflictTrip={handleConflictTrip}
      />

      {/* Модалка для редактирования конфликтного рейса */}
      {conflictTripId && (
        <TripCorrectionModal
          isOpen={true}
          onClose={() => setConflictTripId(null)}
          mode="edit"
          tripId={conflictTripId}
          onCorrectionSent={() => {
            setConflictTripId(null);
            setCorrectionModalOpen(true); // Возвращаемся к созданию рейсов
          }}
          onOpenConflictTrip={handleConflictTrip}
        />
      )}
    </>
  );
}
