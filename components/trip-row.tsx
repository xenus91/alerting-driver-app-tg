"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

interface TripRowProps {
  trip: Trip
  tripIndex: number
  availablePoints: Point[]
  onUpdateTrip: (index: number, field: keyof Trip, value: any) => void
  onUpdatePoint: (tripIndex: number, pointIndex: number, field: keyof Point, value: any) => void
  onRemovePoint: (tripIndex: number, pointIndex: number) => void
  onAddPoint: (tripIndex: number) => void
  onMovePointUp: (tripIndex: number, pointIndex: number) => void
  onMovePointDown: (tripIndex: number, pointIndex: number) => void
  onRemoveTrip: (index: number) => void
  canMoveUp: (tripIndex: number, pointIndex: number) => boolean
  canMoveDown: (tripIndex: number, pointIndex: number) => boolean
  showRemoveTrip?: boolean
}

export function TripRow({
  trip,
  tripIndex,
  availablePoints,
  onUpdateTrip,
  onUpdatePoint,
  onRemovePoint,
  onAddPoint,
  onMovePointUp,
  onMovePointDown,
  onRemoveTrip,
  canMoveUp,
  canMoveDown,
  showRemoveTrip = true,
}: TripRowProps) {
  console.log(`🚛 Rendering TripRow ${tripIndex} with ${trip.points.length} points`)

  // Сортируем точки только по point_num
  const sortedPoints = [...trip.points].sort((a, b) => a.point_num - b.point_num)
  console.log(
    `📍 Sorted points for trip ${tripIndex}:`,
    sortedPoints.map((p) => ({ id: p.point_id, num: p.point_num, type: p.point_type })),
  )

  const getOriginalIndex = (sortedIndex: number) => {
    const sortedPoint = sortedPoints[sortedIndex]
    const originalIndex = trip.points.findIndex(
      (p) =>
        p.point_id === sortedPoint.point_id &&
        p.point_num === sortedPoint.point_num &&
        p.point_type === sortedPoint.point_type,
    )
    console.log(`🔍 Original index for sorted index ${sortedIndex}: ${originalIndex}`)
    return originalIndex
  }

  return (
    <Card className="border-2">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Рейс {tripIndex + 1}</h3>
            {trip.original_trip_identifier && (
              <Badge variant="outline">Исходный: {trip.original_trip_identifier}</Badge>
            )}
          </div>
          {showRemoveTrip && (
            <Button variant="destructive" size="sm" onClick={() => onRemoveTrip(tripIndex)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Номер рейса</Label>
            <Input
              value={trip.trip_identifier}
              onChange={(e) => onUpdateTrip(tripIndex, "trip_identifier", e.target.value)}
              placeholder="Введите номер рейса"
            />
          </div>
          <div>
            <Label>Номер транспорта</Label>
            <Input
              value={trip.vehicle_number}
              onChange={(e) => onUpdateTrip(tripIndex, "vehicle_number", e.target.value)}
              placeholder="Введите номер транспорта"
            />
          </div>
          <div>
            <Label>Время погрузки</Label>
            <Input
              type="datetime-local"
              value={trip.planned_loading_time}
              onChange={(e) => onUpdateTrip(tripIndex, "planned_loading_time", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Комментарий</Label>
          <Input
            value={trip.driver_comment}
            onChange={(e) => onUpdateTrip(tripIndex, "driver_comment", e.target.value)}
            placeholder="Комментарий к рейсу"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">Точки маршрута</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => onAddPoint(tripIndex)}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить точку
            </Button>
          </div>

          <div className="space-y-3">
            {sortedPoints.map((point, sortedIndex) => {
              const originalIndex = getOriginalIndex(sortedIndex)

              console.log(`🎯 Rendering point ${sortedIndex} (original: ${originalIndex}):`, {
                id: point.point_id,
                num: point.point_num,
                type: point.point_type,
              })

              return (
                <div
                  key={`point-${tripIndex}-${sortedIndex}-${point.point_id}-${point.point_num}`}
                  className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50"
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log(`⬆️ Move up clicked - Trip: ${tripIndex}, Original Index: ${originalIndex}`)
                        onMovePointUp(tripIndex, originalIndex)
                      }}
                      disabled={!canMoveUp(tripIndex, originalIndex)}
                      className="h-6 w-6 p-0"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log(`⬇️ Move down clicked - Trip: ${tripIndex}, Original Index: ${originalIndex}`)
                        onMovePointDown(tripIndex, originalIndex)
                      }}
                      disabled={!canMoveDown(tripIndex, originalIndex)}
                      className="h-6 w-6 p-0"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Порядок</Label>
                      <div className="text-sm font-semibold bg-white px-2 py-1 rounded border">{point.point_num}</div>
                    </div>

                    <div>
                      <Label className="text-xs">Точка</Label>
                      <Select
                        value={point.point_id}
                        onValueChange={(value) => {
                          console.log(
                            `🔄 Point selection changed - Trip: ${tripIndex}, Original Index: ${originalIndex}, Value: ${value}`,
                          )
                          onUpdatePoint(tripIndex, originalIndex, "point_id", value)
                        }}
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
                        onValueChange={(value) => {
                          console.log(
                            `🔄 Point type changed - Trip: ${tripIndex}, Original Index: ${originalIndex}, Value: ${value}`,
                          )
                          onUpdatePoint(tripIndex, originalIndex, "point_type", value as "P" | "D")
                        }}
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
                    onClick={() => {
                      console.log(`🗑️ Remove point clicked - Trip: ${tripIndex}, Original Index: ${originalIndex}`)
                      onRemovePoint(tripIndex, originalIndex)
                    }}
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
  )
}
