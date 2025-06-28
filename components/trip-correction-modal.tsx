"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Save, X } from "lucide-react"
import { toast } from "sonner"

interface Point {
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: string
  longitude?: string
}

interface TripCorrection {
  phone: string
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  message_id: number
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: string
  longitude?: string
}

interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  phone: string
  initialCorrections: TripCorrection[]
  onSave: () => void
}

export function TripCorrectionModal({
  isOpen,
  onClose,
  tripId,
  phone,
  initialCorrections,
  onSave,
}: TripCorrectionModalProps) {
  const [corrections, setCorrections] = useState<TripCorrection[]>([])
  const [deletedTrips, setDeletedTrips] = useState<string[]>([])
  const [availablePoints, setAvailablePoints] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

useEffect(() => {
  if (isOpen) {
    // Защита от undefined/empty
    setCorrections(initialCorrections?.length ? [...initialCorrections] : [])
    setDeletedTrips([])
    fetchAvailablePoints()
  }
}, [isOpen, initialCorrections])

  const fetchAvailablePoints = async () => {
    try {
      const response = await fetch("/api/points")
      if (response.ok) {
        const data = await response.json()
        setAvailablePoints(data.points || [])
      }
    } catch (error) {
      console.error("Error fetching points:", error)
    }
  }

  // Группируем корректировки по trip_identifier (БЕЗ сортировки)
  const tripGroups = corrections.reduce((acc: Record<string, TripCorrection[]>, correction) => {
    const key = correction.trip_identifier
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(correction)
    return acc
  }, {})

  const updateCorrection = (tripIdentifier: string, field: string, value: any) => {
    setCorrections((prev) =>
      prev.map((correction) =>
        correction.trip_identifier === tripIdentifier ? { ...correction, [field]: value } : correction,
      ),
    )
  }

  const updatePoint = (tripIdentifier: string, pointType: "P" | "D", pointNum: number, field: string, value: any) => {
    setCorrections((prev) =>
      prev.map((correction) =>
        correction.trip_identifier === tripIdentifier &&
        correction.point_type === pointType &&
        correction.point_num === pointNum
          ? { ...correction, [field]: value }
          : correction,
      ),
    )
  }

  const addPoint = (tripIdentifier: string, pointType: "P" | "D") => {
    const existingPoints = corrections.filter((c) => c.trip_identifier === tripIdentifier && c.point_type === pointType)
    const nextPointNum = Math.max(0, ...existingPoints.map((p) => p.point_num)) + 1
    const firstCorrection = corrections.find((c) => c.trip_identifier === tripIdentifier)

    if (firstCorrection) {
      const newPoint: TripCorrection = {
        ...firstCorrection,
        point_type: pointType,
        point_num: nextPointNum,
        point_id: "",
        point_name: "",
        door_open_1: "",
        door_open_2: "",
        door_open_3: "",
        latitude: "",
        longitude: "",
      }
      setCorrections((prev) => [...prev, newPoint])
    }
  }

  const removePoint = (tripIdentifier: string, pointType: "P" | "D", pointNum: number) => {
    setCorrections((prev) =>
      prev.filter(
        (correction) =>
          !(
            correction.trip_identifier === tripIdentifier &&
            correction.point_type === pointType &&
            correction.point_num === pointNum
          ),
      ),
    )
  }

  const removeTrip = (tripIdentifier: string) => {
    // Добавляем в список удаленных рейсов
    setDeletedTrips((prev) => [...prev, tripIdentifier])

    // Удаляем из корректировок
    const updated = corrections.filter((c) => c.trip_identifier !== tripIdentifier)
    setCorrections(updated)
  }

  const addNewTrip = () => {
    const newTripIdentifier = `NEW_${Date.now()}`
    const baseCorrection = corrections[0] || {
      phone,
      trip_identifier: newTripIdentifier,
      vehicle_number: "",
      planned_loading_time: new Date().toISOString().slice(0, 16),
      driver_comment: "",
      message_id: tripId,
      point_type: "P" as const,
      point_num: 1,
      point_id: "",
      point_name: "",
      door_open_1: "",
      door_open_2: "",
      door_open_3: "",
      latitude: "",
      longitude: "",
    }

    const newTrip: TripCorrection = {
      ...baseCorrection,
      trip_identifier: newTripIdentifier,
    }

    setCorrections((prev) => [...prev, newTrip])
  }

  const handlePointSelect = (tripIdentifier: string, pointType: "P" | "D", pointNum: number, pointId: string) => {
    const selectedPoint = availablePoints.find((p) => p.point_id === pointId)
    if (selectedPoint) {
      updatePoint(tripIdentifier, pointType, pointNum, "point_id", selectedPoint.point_id)
      updatePoint(tripIdentifier, pointType, pointNum, "point_name", selectedPoint.point_name)
      updatePoint(tripIdentifier, pointType, pointNum, "latitude", selectedPoint.latitude?.toString() || "")
      updatePoint(tripIdentifier, pointType, pointNum, "longitude", selectedPoint.longitude?.toString() || "")
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Сохраняем корректировки
      const saveResponse = await fetch(`/api/trips/${tripId}/save-corrections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          corrections,
          deletedTrips,
        }),
      })

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json()
        throw new Error(errorData.error || "Failed to save corrections")
      }

      // Отправляем корректировку
      const messageIds = [...new Set(corrections.map((c) => c.message_id))]
      const resendResponse = await fetch(`/api/trips/messages/${tripId}/resend-combined`, {
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

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json()
        throw new Error(errorData.error || "Failed to send correction")
      }

      toast.success("Корректировка сохранена и отправлена")
      onSave()
      onClose()
    } catch (error) {
      console.error("Error saving corrections:", error)
      toast.error(error instanceof Error ? error.message : "Ошибка при сохранении корректировки")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Корректировка рейсов для {phone}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(tripGroups).map(([tripIdentifier, tripCorrections]) => {
            const firstCorrection = tripCorrections[0]
            const loadingPoints = tripCorrections.filter((c) => c.point_type === "P")
            const unloadingPoints = tripCorrections.filter((c) => c.point_type === "D")

            return (
              <Card key={tripIdentifier} className="relative">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Рейс {tripIdentifier}</CardTitle>
                    <Button variant="destructive" size="sm" onClick={() => removeTrip(tripIdentifier)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`vehicle-${tripIdentifier}`}>Номер транспорта</Label>
                      <Input
                        id={`vehicle-${tripIdentifier}`}
                        value={firstCorrection.vehicle_number}
                        onChange={(e) => updateCorrection(tripIdentifier, "vehicle_number", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`time-${tripIdentifier}`}>Время погрузки</Label>
                      <Input
                        id={`time-${tripIdentifier}`}
                        type="datetime-local"
                        value={firstCorrection.planned_loading_time?.slice(0, 16) || ""}
                        onChange={(e) => updateCorrection(tripIdentifier, "planned_loading_time", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`comment-${tripIdentifier}`}>Комментарий</Label>
                    <Textarea
                      id={`comment-${tripIdentifier}`}
                      value={firstCorrection.driver_comment || ""}
                      onChange={(e) => updateCorrection(tripIdentifier, "driver_comment", e.target.value)}
                    />
                  </div>

                  {/* Точки погрузки */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base font-semibold">Точки погрузки</Label>
                      <Button variant="outline" size="sm" onClick={() => addPoint(tripIdentifier, "P")}>
                        <Plus className="h-4 w-4 mr-1" />
                        Добавить
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {loadingPoints.map((point) => (
                        <div
                          key={`${tripIdentifier}-P-${point.point_num}`}
                          className="flex items-center gap-2 p-2 border rounded"
                        >
                          <Badge variant="secondary">P{point.point_num}</Badge>
                          <Select
                            value={point.point_id}
                            onValueChange={(value) => handlePointSelect(tripIdentifier, "P", point.point_num, value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Выберите точку" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePoints.map((p) => (
                                <SelectItem key={p.point_id} value={p.point_id}>
                                  {p.point_id} - {p.point_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removePoint(tripIdentifier, "P", point.point_num)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Точки разгрузки */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base font-semibold">Точки разгрузки</Label>
                      <Button variant="outline" size="sm" onClick={() => addPoint(tripIdentifier, "D")}>
                        <Plus className="h-4 w-4 mr-1" />
                        Добавить
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {unloadingPoints.map((point) => (
                        <div
                          key={`${tripIdentifier}-D-${point.point_num}`}
                          className="flex items-center gap-2 p-2 border rounded"
                        >
                          <Badge variant="secondary">D{point.point_num}</Badge>
                          <Select
                            value={point.point_id}
                            onValueChange={(value) => handlePointSelect(tripIdentifier, "D", point.point_num, value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Выберите точку" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePoints.map((p) => (
                                <SelectItem key={p.point_id} value={p.point_id}>
                                  {p.point_id} - {p.point_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <Input
                              placeholder="Ворота 1"
                              value={point.door_open_1 || ""}
                              onChange={(e) =>
                                updatePoint(tripIdentifier, "D", point.point_num, "door_open_1", e.target.value)
                              }
                              className="w-20"
                            />
                            <Input
                              placeholder="Ворота 2"
                              value={point.door_open_2 || ""}
                              onChange={(e) =>
                                updatePoint(tripIdentifier, "D", point.point_num, "door_open_2", e.target.value)
                              }
                              className="w-20"
                            />
                            <Input
                              placeholder="Ворота 3"
                              value={point.door_open_3 || ""}
                              onChange={(e) =>
                                updatePoint(tripIdentifier, "D", point.point_num, "door_open_3", e.target.value)
                              }
                              className="w-20"
                            />
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removePoint(tripIdentifier, "D", point.point_num)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <div className="flex justify-between">
            <Button variant="outline" onClick={addNewTrip}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить новый рейс
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Сохранение..." : "Сохранить и отправить"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
