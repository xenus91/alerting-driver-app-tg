"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RefreshCw, Send, Plus, Trash2, User, Zap, Check, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  points: Array<{
    point_type: "P" | "D"
    point_num: number
    point_id: string
  }>
}

interface Driver {
  phone: string
  first_name?: string
  full_name?: string
  name: string
  telegram_id: number
  verified: boolean
}

interface QuickTripFormProps {
  isOpen: boolean
  onClose: () => void
  onTripSent: () => void
}

interface DriverWithTrips {
  driver: Driver;
  trips: TripData[];
}

export function QuickTripForm({ isOpen, onClose, onTripSent }: QuickTripFormProps) {
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  
  // Закрытие обеих модалок
  const handleClose = () => {
    onClose();
    setCorrectionModalOpen(false);
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

      <TripCorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        mode="create"
        onAssignmentSent={(results) => {
          onTripSent();
          handleClose();
        }}
        onOpenConflictTrip={(tripId, driverPhone, driverName) => {
          // Реализация просмотра конфликтного рейса
          console.log("Opening conflict trip:", tripId);
        }}
      />
    </>
  );
}
