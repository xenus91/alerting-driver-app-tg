"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Save, Send, Plus, AlertTriangle } from "lucide-react"
import { TripRow } from "./trip-row"

interface CorrectionData {
  phone: string
  trip_identifier: string
  original_trip_identifier?: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  message_id: number
  points: PointData[]
}

interface PointData {
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name?: string
  latitude?: string
  longitude?: string
}

/* ИЗМЕНЕНИЕ: Обновлён интерфейс TripCorrectionModalProps, чтобы onCorrectionSent принимал corrections и deletedTrips вместо tripIdentifiers и pointIds */
interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  phone: string
  driverName: string
  onCorrectionSent: (corrections: CorrectionData[], deletedTrips: string[]) => void
}


export function TripCorrectionModal({
  isOpen,
  onClose,
  tripId,
  phone,
  driverName,
  onCorrectionSent,
}: TripCorrectionModalProps) {
  const [corrections, setCorrections] = useState<CorrectionData[]>([])
  const [deletedTrips, setDeletedTrips] = useState<string[]>([])
  const [availablePoints, setAvailablePoints] = useState<Array<{ point_id: string; point_name: string; latitude?: string; longitude?: string }>>([])
  const [pointSearchStates, setPointSearchStates] = useState<Record<string, { open: boolean; search: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadDriverDetails()
      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone])

  const loadDriverDetails = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/driver-details?phone=${phone}`)
      const data = await response.json()

      if (data.success) {
        const grouped = data.data.reduce((acc: Record<string, CorrectionData>, item: any) => {
          const key = item.trip_identifier
          if (!acc[key]) {
            acc[key] = {
              phone: item.phone,
              trip_identifier: item.trip_identifier,
              original_trip_identifier: item.trip_identifier,
              vehicle_number: item.vehicle_number,
              planned_loading_time: item.planned_loading_time,
              driver_comment: item.driver_comment,
              message_id: item.message_id,
              points: [],
            }
          }
          acc[key].points.push({
            point_type: item.point_type,
            point_num: item.point_num,
            point_id: item.point_id,
            point_name: item.point_name,
            latitude: item.latitude,
            longitude: item.longitude,
          })
          return acc
        }, {})
        setCorrections(Object.values(grouped))
      } else {
        setError(data.error || "Failed to load driver details")
      }
    } catch (error) {
      setError("Error loading driver details")
      console.error("Error loading driver details:", error)
    } finally {
      setIsLoading(false)
      setDeletedTrips([])
    }
  }

  const loadAvailablePoints = async () => {
    try {
      const response = await fetch("/api/points")
      const data = await response.json()

      if (data.success) {
        setAvailablePoints(data.points.map((p: any) => ({
          point_id: p.point_id,
          point_name: p.point_name,
          latitude: p.latitude,
          longitude: p.longitude,
        })))
      }
    } catch (error) {
      console.error("Error loading points:", error)
    }
  }

  const updateTrip = useCallback((tripIndex: number, field: keyof CorrectionData, value: any) => {
    setCorrections((prev) => {
      const updated = [...prev]
      updated[tripIndex] = { ...updated[tripIndex], [field]: value }
      return updated
    })
  }, [])

  const updatePoint = useCallback((tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => {
    setCorrections((prev) => {
      const updated = [...prev]
      updated[tripIndex].points[pointIndex] = { ...updated[tripIndex].points[pointIndex], [field]: value }
      return updated
    })
  }, [])

  const addNewPoint = (tripIndex: number) => {
    const maxPointNum = Math.max(...corrections[tripIndex].points.map((p) => p.point_num || 0), 0)
    const newPoint: PointData = {
      point_type: "P",
      point_num: maxPointNum + 1,
      point_id: "",
      point_name: "",
      latitude: "",
      longitude: "",
    }
    setCorrections((prev) => {
      const updated = [...prev]
      updated[tripIndex].points = [...updated[tripIndex].points, newPoint]
      return updated
    })
  }

  const addNewTrip = () => {
    const newTrip: CorrectionData = {
      phone,
      trip_identifier: "",
      vehicle_number: "",
      planned_loading_time: new Date().toISOString(),
      driver_comment: "",
      message_id: corrections[0]?.message_id || 0,
      points: [
        {
          point_type: "P",
          point_num: 1,
          point_id: "",
          point_name: "",
          latitude: "",
          longitude: "",
        },
      ],
    }
    setCorrections([...corrections, newTrip])
  }

  const removePoint = (tripIndex: number, pointIndex: number) => {
    setCorrections((prev) => {
      const updated = [...prev]
      updated[tripIndex].points = updated[tripIndex].points.filter((_, i) => i !== pointIndex)
      return updated
    })
  }

  const removeTrip = (tripIndex: number) => {
    const tripIdentifier = corrections[tripIndex].original_trip_identifier || corrections[tripIndex].trip_identifier
    setCorrections((prev) => prev.filter((_, i) => i !== tripIndex))
    if (tripIdentifier) {
      setDeletedTrips((prev) => [...prev, tripIdentifier])
    }
  }

  const saveCorrections = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const flatCorrections = corrections.flatMap((trip) =>
        trip.points.map((point, index) => ({
          phone: trip.phone,
          trip_identifier: trip.trip_identifier,
          original_trip_identifier: trip.original_trip_identifier,
          vehicle_number: trip.vehicle_number,
          planned_loading_time: trip.planned_loading_time,
          driver_comment: trip.driver_comment,
          message_id: trip.message_id,
          point_type: point.point_type,
          point_num: index + 1,
          point_id: point.point_id,
          point_name: point.point_name,
          latitude: point.latitude,
          longitude: point.longitude,
        }))
      )

      const response = await fetch(`/api/trips/${tripId}/save-corrections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          corrections: flatCorrections,
          deletedTrips,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("Корректировки сохранены успешно!")
        return true // === ИЗМЕНЕНИЕ: Возвращаем true при успехе ===
      } else {
        setError(data.error || "Failed to save corrections")
        return false
      }
    } catch (error) {
      setError("Error saving corrections")
      console.error("Error saving corrections:", error)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const sendCorrection = async () => {
  setIsSending(true)
  setError(null)
  setSuccess(null)

  try {
    console.log("sendCorrection: Starting saveCorrections")
    const saveSuccess = await saveCorrections()
    if (!saveSuccess) {
      throw new Error("Failed to save corrections before sending")
    }

    const messageIds = [...new Set(corrections.map((c) => c.message_id))]
    

    /* ИЗМЕНЕНИЕ: Передаём полные corrections и deletedTrips в onCorrectionSent вместо tripIdentifiers и pointIds */
      console.log("sendCorrection: corrections:", corrections, "deletedTrips:", deletedTrips)

    const response = await fetch(`/api/trips/messages/${messageIds[0]}/resend-combined`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        messageIds,
        isCorrection: true,
        deletedTrips,
      }),
    })

    const data = await response.json()

    if (data.success) {
      setSuccess("Корректировка отправлена водителю! Статус подтверждения сброшен - требуется новое подтверждение.")
      await new Promise((resolve) => setTimeout(resolve, 1000))
              /* ИЗМЕНЕНИЕ: Исправлен вызов onCorrectionSent, чтобы передавать corrections и deletedTrips вместо tripIdentifiers, pointIds, points */
        onCorrectionSent(corrections, deletedTrips)
      setTimeout(() => {
        onClose()
      }, 3000)
    } else {
      setError(data.error || "Failed to send correction")
    }
  } catch (error) {
    setError("Error sending correction")
    console.error("Error sending correction:", error)
  } finally {
    setIsSending(false)
  }
}

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""

    try {
      if (dateString.includes("T")) {
        const [datePart, timePart] = dateString.split("T")
        const timeWithoutSeconds = timePart.split(":").slice(0, 2).join(":")
        return `${datePart}T${timeWithoutSeconds}`
      }

      if (dateString.includes("/") || dateString.includes("-")) {
        const dateMatch = dateString.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
        const timeMatch = dateString.match(/(\d{1,2}):(\d{2})/)

        if (dateMatch && timeMatch) {
          const [, day, month, year] = dateMatch
          const [, hours, minutes] = timeMatch

          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes}`
        }
      }

      return ""
    } catch (error) {
      console.error("Error formatting date:", error, "Input:", dateString)
      return ""
    }
  }

  const formatDateTimeForSave = (dateString: string) => {
    if (!dateString) return ""
    try {
      return dateString + ":00.000"
    } catch {
      return dateString
    }
  }

  const handleSearchStateChange = useCallback((key: string, state: { open?: boolean; search?: string }) => {
    setPointSearchStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...state },
    }))
  }, [])

  const movePointUp = useCallback((tripIndex: number, pointIndex: number) => {
  setCorrections(prev => {
    const newCorrections = [...prev];
    const points = [...newCorrections[tripIndex].points];
    
    // Меняем местами с предыдущей точкой
    if (pointIndex > 0) {
      [points[pointIndex], points[pointIndex - 1]] = [points[pointIndex - 1], points[pointIndex]];
    }
    
    newCorrections[tripIndex] = {
      ...newCorrections[tripIndex],
      points: points
    };
    
    return newCorrections;
  });
}, []);

const movePointDown = useCallback((tripIndex: number, pointIndex: number) => {
  setCorrections(prev => {
    const newCorrections = [...prev];
    const points = [...newCorrections[tripIndex].points];
    
    // Меняем местами со следующей точкой
    if (pointIndex < points.length - 1) {
      [points[pointIndex], points[pointIndex + 1]] = [points[pointIndex + 1], points[pointIndex]];
    }
    
    newCorrections[tripIndex] = {
      ...newCorrections[tripIndex],
      points: points
    };
    
    return newCorrections;
  });
}, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Корректировка рейсов для {driverName}</DialogTitle>
        </DialogHeader>

        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Внимание:</strong> При отправке корректировки статус подтверждения рейсов будет сброшен. Водителю
            потребуется заново подтвердить скорректированные рейсы.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Загрузка данных...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={addNewTrip} variant="outline" className="text-green-600">
                <Plus className="h-4 w-4 mr-2" />
                Добавить новый рейс
              </Button>
            </div>

            {corrections.map((trip, tripIndex) => (
              <TripRow
                key={trip.original_trip_identifier || `trip-${tripIndex}`}
                trip={trip}
                tripIndex={tripIndex}
                availablePoints={availablePoints}
                pointSearchStates={pointSearchStates}
                handleSearchStateChange={handleSearchStateChange}
                updateTrip={updateTrip}
                updatePoint={updatePoint}
                addNewPoint={addNewPoint}
                removePoint={removePoint}
                removeTrip={removeTrip}
                correctionsLength={corrections.length}
                formatDateTime={formatDateTime}
                formatDateTimeForSave={formatDateTimeForSave}
                movePointUp={movePointUp}      // Передаем новую функцию
                movePointDown={movePointDown}  // Передаем новую функцию
              />
            ))}

            <div className="flex gap-4 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button onClick={saveCorrections} disabled={isSaving} variant="secondary">
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить
                  </>
                )}
              </Button>
              <Button onClick={sendCorrection} disabled={isSending || isSaving}>
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить корректировку
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
