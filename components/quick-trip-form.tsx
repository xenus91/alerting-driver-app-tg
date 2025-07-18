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
  const [conflictData, setConflictData] = useState<{
    tripId: number;
    phone: string;
    driverName: string;
  } | null>(null);
  
  console.log("QuickTripForm render:", {
    isOpen,
    correctionModalOpen,
    conflictData
  });

  const handleClose = () => {
    console.log("Closing all modals");
    onClose();
    setCorrectionModalOpen(false);
    setConflictData(null);
  };

  const handleConflictTrip = (tripId: number, driverPhone: string, driverName: string) => {
  console.log("Handling conflict trip:", { tripId, driverPhone, driverName });
  
  // Закрываем текущую модалку
  setCorrectionModalOpen(false);
  
  // После небольшой задержки открываем модалку редактирования
  setTimeout(() => {
    setConflictData({
      tripId,
      phone: driverPhone,
      driverName
    });
  }, 100);
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
              onClick={() => {
                console.log("Opening create modal");
                setCorrectionModalOpen(true);
              }}
            >
              <Plus className="mr-2" />
              Создать новые рейсы
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Модалка для создания новых рейсов */}
      {correctionModalOpen && !conflictData && (
        <TripCorrectionModal
          isOpen={true}
          onClose={() => {
            console.log("Closing create modal");
            setCorrectionModalOpen(false);
          }}
          mode="create"
          onAssignmentSent={() => {
            console.log("Assignment sent successfully");
            onTripSent();
            handleClose();
          }}
          onOpenConflictTrip={handleConflictTrip}
        />
      )}

            {conflictData && (
        <TripCorrectionModal
          key={`edit-${conflictData.tripId}-${conflictData.phone}`} // Добавляем ключ для принудительного ререндера
          isOpen={true}
          onClose={() => {
            console.log("Closing conflict modal");
            setConflictData(null);
            setCorrectionModalOpen(true);
          }}
          mode="edit"
          tripId={conflictData.tripId}
          phone={conflictData.phone}
          driverName={conflictData.driverName}
          onCorrectionSent={() => {
            console.log("Correction sent successfully");
            setConflictData(null);
            setCorrectionModalOpen(true);
          }}
          onOpenConflictTrip={handleConflictTrip}
        />
      )}
    </>
  );
}
