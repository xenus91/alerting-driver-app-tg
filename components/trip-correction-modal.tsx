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
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface Point {
  point_id: string
  point_name: string
  point_type: "P" | "D"
  point_num: number
  latitude?: number
  longitude?: number
  adress?: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
}

interface Trip {
  trip_identifier: string
  original_trip_identifier?: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  points: Point[]
  message_id: number
}

interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  phone?: string
  driverName?: string
  mode: "edit" | "create"
  onCorrectionSent?: () => void
}

export function TripCorrectionModal({
  isOpen,
  onClose,
  tripId,
  phone,
  driverName,
  mode,
  onCorrectionSent,
}: TripCorrectionModalProps) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [availablePoints, setAvailablePoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletedTrips, setDeletedTrips] = useState<string[]>([])

  console.log("🔄 TripCorrectionModal useEffect:", { isOpen, mode, tripId, phone, driverName })

  useEffect(() => {
    if (isOpen && mode === "edit" && tripId && phone) {
      console.log("📥 Loading driver details for editing...")
      loadDriverDetails()
    } else if (isOpen && mode === "create") {
      console.log("➕ Creating new trip...")
      createNewTrip()
    }
    loadAvailablePoints()
  }, [isOpen, mode, tripId, phone])

  const loadDriverDetails = async () => {
    setLoading(true)
    try {
      console.log(`🔍 Fetching driver details for trip ${tripId}, phone ${phone}`)
      const response = await fetch(`/api/trips/${tripId}/driver-details?phone=${phone}`)
      const data = await response.json()

      console.log("📊 Raw driver data:", data)

      if (data.success && data.data) {
        const groupedData = data.data
        console.log("📋 Grouped driver data:", groupedData)

        const tripsArray = Object.values(groupedData).map((driverData: any) => ({
          trip_identifier: driverData.trip_identifier,
          original_trip_identifier: driverData.original_trip_identifier || driverData.trip_identifier,
          vehicle_number: driverData.vehicle_number,
          planned_loading_time: driverData.planned_loading_time,
          driver_comment: driverData.driver_comment || "",
          message_id: driverData.message_id,
          points: driverData.points || [],
        }))

        console.log("🚛 Processed trips array:", tripsArray)
        setTrips(tripsArray)
      }
    } catch (error) {
      console.error("❌ Error loading driver details:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные водителя",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      console.log("✅ Finished loading driver details")
    }
  }

  const loadAvailablePoints = async () => {
    try {
      console.log("🗺️ Loading available points...")
      const response = await fetch("/api/points")
      const data = await response.json()

      if (data.success) {
        console.log(`📍 Loaded ${data.data.length} available points`)
        setAvailablePoints(data.data)
      }
    } catch (error) {
      console.error("❌ Error loading points:", error)
    }
  }

  const createNewTrip = () => {
    console.log("🆕 Creating new trip template")
    const newTrip: Trip = {
      trip_identifier: "",
      vehicle_number: "",
      planned_loading_time: new Date().toISOString().slice(0, 16),
      driver_comment: "",
      points: [],
      message_id: 0,
    }
    setTrips([newTrip])
  }

  const updateTrip = (index: number, field: keyof Trip, value: any) => {
    console.log(`✏️ Updating trip ${index}, field: ${field}, value:`, value)
    setTrips((prev) => prev.map((trip, i) => (i === index ? { ...trip, [field]: value } : trip)))
  }

  const addTrip = () => {
    console.log("➕ Adding new trip")
    const newTrip: Trip = {
      trip_identifier: "",
      vehicle_number: "",
      planned_loading_time: new Date().toISOString().slice(0, 16),
      driver_comment: "",
      points: [],
      message_id: 0,
    }
    setTrips((prev) => [...prev, newTrip])
  }

  const removeTrip = (index: number) => {
    console.log(`🗑️ Removing trip at index ${index}`)
    const tripToRemove = trips[index]
    if (tripToRemove.original_trip_identifier) {
      console.log(`📝 Adding ${tripToRemove.original_trip_identifier} to deleted trips`)
      setDeletedTrips((prev) => [...prev, tripToRemove.original_trip_identifier!])
    }
    setTrips((prev) => prev.filter((_, i) => i !== index))
  }

  const addPointToTrip = (tripIndex: number) => {
    console.log(`📍 Adding point to trip ${tripIndex}`)
    const trip = trips[tripIndex]
    const maxPointNum = trip.points.length > 0 ? Math.max(...trip.points.map((p) => p.point_num)) : 0

    const newPoint: Point = {
      point_id: "",
      point_name: "",
      point_type: "P",
      point_num: maxPointNum + 1,
    }

    console.log(`🔢 New point will have point_num: ${newPoint.point_num}`)

    setTrips((prev) =>
      prev.map((trip, i) => (i === tripIndex ? { ...trip, points: [...trip.points, newPoint] } : trip)),
    )
  }

  const updatePoint = (tripIndex: number, pointIndex: number, field: keyof Point, value: any) => {
    console.log(`🎯 Updating point - Trip: ${tripIndex}, Point: ${pointIndex}, Field: ${field}, Value:`, value)

    setTrips((prev) =>
      prev.map((trip, i) => {
        if (i !== tripIndex) return trip

        const updatedPoints = trip.points.map((point, j) => {
          if (j !== pointIndex) return point

          if (field === "point_id") {
            const selectedPoint = availablePoints.find((p) => p.point_id === value)
            if (selectedPoint) {
              console.log(`🔍 Found selected point:`, selectedPoint)
              return {
                ...point,
                point_id: selectedPoint.point_id,
                point_name: selectedPoint.point_name,
                latitude: selectedPoint.latitude,
                longitude: selectedPoint.longitude,
                adress: selectedPoint.adress,
                door_open_1: selectedPoint.door_open_1,
                door_open_2: selectedPoint.door_open_2,
                door_open_3: selectedPoint.door_open_3,
              }
            }
          }

          return { ...point, [field]: value }
        })

        return { ...trip, points: updatedPoints }
      }),
    )
  }

  const removePoint = (tripIndex: number, pointIndex: number) => {
    console.log(`🗑️ Removing point - Trip: ${tripIndex}, Point: ${pointIndex}`)

    setTrips((prev) =>
      prev.map((trip, i) => {
        if (i !== tripIndex) return trip

        const updatedPoints = trip.points.filter((_, j) => j !== pointIndex)

        // Пересчитываем point_num для оставшихся точек
        const recalculatedPoints = updatedPoints
          .sort((a, b) => a.point_num - b.point_num)
          .map((point, index) => ({
            ...point,
            point_num: index + 1,
          }))

        console.log(
          `🔢 Recalculated point numbers after removal:`,
          recalculatedPoints.map((p) => ({ id: p.point_id, num: p.point_num })),
        )

        return { ...trip, points: recalculatedPoints }
      }),
    )
  }

  const movePointUp = (tripIndex: number, pointIndex: number) => {
    const trip = trips[tripIndex]
    const currentPoint = trip.points[pointIndex]

    // Находим точку с point_num на 1 меньше
    const targetPointNum = currentPoint.point_num - 1
    const targetPointIndex = trip.points.findIndex((p) => p.point_num === targetPointNum)

    if (targetPointIndex === -1) {
      console.log(`⬆️ Cannot move point up - no point with point_num ${targetPointNum}`)
      return
    }

    console.log(`⬆️ Moving point up - Current: ${currentPoint.point_num} -> ${targetPointNum}`)

    setTrips((prev) =>
      prev.map((trip, i) => {
        if (i !== tripIndex) return trip

        const updatedPoints = trip.points.map((point, j) => {
          if (j === pointIndex) {
            return { ...point, point_num: targetPointNum }
          } else if (j === targetPointIndex) {
            return { ...point, point_num: currentPoint.point_num }
          }
          return point
        })

        console.log(
          `🔄 After move up:`,
          updatedPoints.map((p) => ({ id: p.point_id, num: p.point_num })),
        )
        return { ...trip, points: updatedPoints }
      }),
    )
  }

  const movePointDown = (tripIndex: number, pointIndex: number) => {
    const trip = trips[tripIndex]
    const currentPoint = trip.points[pointIndex]

    // Находим точку с point_num на 1 больше
    const targetPointNum = currentPoint.point_num + 1
    const targetPointIndex = trip.points.findIndex((p) => p.point_num === targetPointNum)

    if (targetPointIndex === -1) {
      console.log(`⬇️ Cannot move point down - no point with point_num ${targetPointNum}`)
      return
    }

    console.log(`⬇️ Moving point down - Current: ${currentPoint.point_num} -> ${targetPointNum}`)

    setTrips((prev) =>
      prev.map((trip, i) => {
        if (i !== tripIndex) return trip

        const updatedPoints = trip.points.map((point, j) => {
          if (j === pointIndex) {
            return { ...point, point_num: targetPointNum }
          } else if (j === targetPointIndex) {
            return { ...point, point_num: currentPoint.point_num }
          }
          return point
        })

        console.log(
          `🔄 After move down:`,
          updatedPoints.map((p) => ({ id: p.point_id, num: p.point_num })),
        )
        return { ...trip, points: updatedPoints }
      }),
    )
  }

  const canMoveUp = (tripIndex: number, pointIndex: number) => {
    const trip = trips[tripIndex]
    const currentPoint = trip.points[pointIndex]
    const targetPointNum = currentPoint.point_num - 1
    return trip.points.some((p) => p.point_num === targetPointNum)
  }

  const canMoveDown = (tripIndex: number, pointIndex: number) => {
    const trip = trips[tripIndex]
    const currentPoint = trip.points[pointIndex]
    const targetPointNum = currentPoint.point_num + 1
    return trip.points.some((p) => p.point_num === targetPointNum)
  }

  const handleSave = async () => {
    console.log("💾 Starting save process...")
    setSaving(true)

    try {
      const corrections = trips.flatMap((trip) =>
        trip.points.map((point) => ({
          trip_identifier: trip.trip_identifier,
          original_trip_identifier: trip.original_trip_identifier,
          vehicle_number: trip.vehicle_number,
          planned_loading_time: trip.planned_loading_time,
          driver_comment: trip.driver_comment,
          point_id: point.point_id,
          point_type: point.point_type,
          point_num: point.point_num,
        })),
      )

      console.log("📝 Corrections to save:", corrections)
      console.log("🗑️ Deleted trips:", deletedTrips)

      const response = await fetch(`/api/trips/${tripId}/save-corrections`, {
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

      const data = await response.json()
      console.log("💾 Save response:", data)

      if (data.success) {
        toast({
          title: "Успешно",
          description: "Корректировки сохранены и отправлены водителю",
        })
        onClose()
        if (onCorrectionSent) {
          console.log("🔄 Calling onCorrectionSent callback")
          onCorrectionSent()
        }
      } else {
        if (data.error === "trip_already_assigned") {
          const conflictInfo = data.conflict_data.map((c: any) => `${c.trip_identifier} (${c.driver_name})`).join(", ")

          toast({
            title: "Конфликт рейсов",
            description: `Рейсы уже назначены другим водителям: ${conflictInfo}`,
            variant: "destructive",
          })
        } else {
          toast({
            title: "Ошибка",
            description: data.details || "Не удалось сохранить корректировки",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("❌ Error saving corrections:", error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при сохранении",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p>Загрузка данных...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Корректировка рейсов" : "Создание нового рейса"}
            {driverName && ` - ${driverName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {trips.map((trip, tripIndex) => (
            <Card key={`trip-${tripIndex}`} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Рейс {tripIndex + 1}
                    {trip.original_trip_identifier && (
                      <Badge variant="outline" className="ml-2">
                        Исходный: {trip.original_trip_identifier}
                      </Badge>
                    )}
                  </CardTitle>
                  {trips.length > 1 && (
                    <Button variant="destructive" size="sm" onClick={() => removeTrip(tripIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`trip-identifier-${tripIndex}`}>Номер рейса</Label>
                    <Input
                      id={`trip-identifier-${tripIndex}`}
                      value={trip.trip_identifier}
                      onChange={(e) => updateTrip(tripIndex, "trip_identifier", e.target.value)}
                      placeholder="Введите номер рейса"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`vehicle-number-${tripIndex}`}>Номер транспорта</Label>
                    <Input
                      id={`vehicle-number-${tripIndex}`}
                      value={trip.vehicle_number}
                      onChange={(e) => updateTrip(tripIndex, "vehicle_number", e.target.value)}
                      placeholder="Введите номер транспорта"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`planned-time-${tripIndex}`}>Время погрузки</Label>
                    <Input
                      id={`planned-time-${tripIndex}`}
                      type="datetime-local"
                      value={trip.planned_loading_time}
                      onChange={(e) => updateTrip(tripIndex, "planned_loading_time", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`driver-comment-${tripIndex}`}>Комментарий</Label>
                  <Textarea
                    id={`driver-comment-${tripIndex}`}
                    value={trip.driver_comment}
                    onChange={(e) => updateTrip(tripIndex, "driver_comment", e.target.value)}
                    placeholder="Комментарий к рейсу"
                    rows={2}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Точки маршрута</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => addPointToTrip(tripIndex)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Добавить точку
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {trip.points
                      .sort((a, b) => a.point_num - b.point_num)
                      .map((point, pointIndex) => {
                        const originalIndex = trip.points.findIndex(
                          (p) =>
                            p.point_id === point.point_id &&
                            p.point_num === point.point_num &&
                            p.point_type === point.point_type,
                        )

                        return (
                          <div
                            key={`point-${tripIndex}-${pointIndex}-${point.point_id}-${point.point_num}`}
                            className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50"
                          >
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => movePointUp(tripIndex, originalIndex)}
                                disabled={!canMoveUp(tripIndex, originalIndex)}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => movePointDown(tripIndex, originalIndex)}
                                disabled={!canMoveDown(tripIndex, originalIndex)}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div>
                                <Label className="text-xs">Порядок</Label>
                                <div className="text-sm font-semibold bg-white px-2 py-1 rounded border">
                                  {point.point_num}
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs">Точка</Label>
                                <Select
                                  value={point.point_id}
                                  onValueChange={(value) => updatePoint(tripIndex, originalIndex, "point_id", value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Выберите точку" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availablePoints.map((availablePoint) => (
                                      <SelectItem key={availablePoint.point_id} value={availablePoint.point_id}>
                                        {availablePoint.point_id} - {availablePoint.point_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Тип</Label>
                                <Select
                                  value={point.point_type}
                                  onValueChange={(value) =>
                                    updatePoint(tripIndex, originalIndex, "point_type", value as "P" | "D")
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="P">Погрузка</SelectItem>
                                    <SelectItem value="D">Разгрузка</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Название</Label>
                                <div className="text-sm bg-white px-2 py-1 rounded border truncate">
                                  {point.point_name || "Не выбрано"}
                                </div>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removePoint(tripIndex, originalIndex)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={addTrip}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить рейс
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
