"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  MapPin,
  Car,
  Calendar,
  MessageSquare,
  Hash,
  Phone,
  ChevronsUpDown,
} from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface PointData {
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name?: string
  latitude?: string
  longitude?: string
}

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

interface TripRowProps {
  trip: CorrectionData
  tripIndex: number
  availablePoints: Array<{
    point_id: string
    point_name: string
    latitude?: string
    longitude?: string
  }>
  pointSearchStates: Record<string, { open: boolean; search: string }>
  handleSearchStateChange: (key: string, state: { open?: boolean; search?: string }) => void
  updateTrip: (tripIndex: number, field: keyof CorrectionData, value: any) => void
  movePointUp: (tripIndex: number, pointIndex: number) => void
  movePointDown: (tripIndex: number, pointIndex: number) => void
  updatePoint: (tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => void
  addNewPoint: (tripIndex: number) => void
  removePoint: (tripIndex: number, pointIndex: number) => void
  removeTrip: (tripIndex: number) => void
  correctionsLength: number
  formatDateTime: (dateString: string) => string
  formatDateTimeForSave: (dateString: string) => string
}

export function TripRow({
  trip,
  tripIndex,
  availablePoints,
  pointSearchStates,
  handleSearchStateChange,
  updateTrip,
  movePointUp,
  movePointDown,
  updatePoint,
  addNewPoint,
  removePoint,
  removeTrip,
  correctionsLength,
  formatDateTime,
  formatDateTimeForSave,
}: TripRowProps) {
  const getPointDisplayName = useCallback(
    (pointId: string) => {
      const point = availablePoints.find((p) => p.point_id === pointId)
      return point ? `${point.point_name} (${point.point_id})` : pointId
    },
    [availablePoints],
  )

  const filteredPoints = useCallback(
    (search: string) => {
      const lowerCaseSearch = search.toLowerCase()
      return availablePoints.filter(
        (point) =>
          point.point_id.toLowerCase().includes(lowerCaseSearch) ||
          (point.point_name || "").toLowerCase().includes(lowerCaseSearch),
      )
    },
    [availablePoints],
  )

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2 text-blue-800">
          <Hash className="h-5 w-5" />
          Рейс {tripIndex + 1}
        </CardTitle>
        {correctionsLength > 1 && (
          <Button variant="destructive" size="sm" onClick={() => removeTrip(tripIndex)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить рейс
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`trip-identifier-${tripIndex}`} className="flex items-center gap-1 mb-1">
              <Hash className="h-3 w-3" /> Идентификатор рейса
            </Label>
            <Input
              id={`trip-identifier-${tripIndex}`}
              value={trip.trip_identifier}
              onChange={(e) => updateTrip(tripIndex, "trip_identifier", e.target.value)}
              placeholder="Уникальный номер рейса"
            />
          </div>
          <div>
            <Label htmlFor={`vehicle-number-${tripIndex}`} className="flex items-center gap-1 mb-1">
              <Car className="h-3 w-3" /> Номер ТС
            </Label>
            <Input
              id={`vehicle-number-${tripIndex}`}
              value={trip.vehicle_number}
              onChange={(e) => updateTrip(tripIndex, "vehicle_number", e.target.value)}
              placeholder="Номер транспортного средства"
            />
          </div>
          <div>
            <Label htmlFor={`planned-loading-time-${tripIndex}`} className="flex items-center gap-1 mb-1">
              <Calendar className="h-3 w-3" /> Плановое время погрузки
            </Label>
            <Input
              id={`planned-loading-time-${tripIndex}`}
              type="datetime-local"
              value={formatDateTime(trip.planned_loading_time)}
              onChange={(e) => updateTrip(tripIndex, "planned_loading_time", formatDateTimeForSave(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor={`phone-${tripIndex}`} className="flex items-center gap-1 mb-1">
              <Phone className="h-3 w-3" /> Телефон водителя
            </Label>
            <Input
              id={`phone-${tripIndex}`}
              value={trip.phone}
              onChange={(e) => updateTrip(tripIndex, "phone", e.target.value)}
              placeholder="Телефон водителя (380xxxxxxxxx)"
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`driver-comment-${tripIndex}`} className="flex items-center gap-1 mb-1">
            <MessageSquare className="h-3 w-3" /> Комментарий для водителя
          </Label>
          <Textarea
            id={`driver-comment-${tripIndex}`}
            value={trip.driver_comment || ""}
            onChange={(e) => updateTrip(tripIndex, "driver_comment", e.target.value)}
            placeholder="Дополнительная информация для водителя"
          />
        </div>

        <h4 className="font-medium mt-6 mb-3 flex items-center gap-2 text-blue-700">
          <MapPin className="h-4 w-4" /> Пункты рейса
        </h4>
        <div className="space-y-3">
          {trip.points
            .sort((a, b) => a.point_num - b.point_num)
            .map((point, pointIndex) => (
              <div key={pointIndex} className="flex items-end gap-2 border p-2 rounded-md bg-white shadow-sm">
                <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`point-type-${tripIndex}-${pointIndex}`} className="text-xs">
                      Тип
                    </Label>
                    <Select
                      value={point.point_type}
                      onValueChange={(value: "P" | "D") => updatePoint(tripIndex, pointIndex, "point_type", value)}
                    >
                      <SelectTrigger id={`point-type-${tripIndex}-${pointIndex}`}>
                        <SelectValue placeholder="Тип пункта" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="P">Погрузка</SelectItem>
                        <SelectItem value="D">Выгрузка</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`point-id-${tripIndex}-${pointIndex}`} className="text-xs">
                      ID Пункта
                    </Label>
                    <Popover
                      open={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open}
                      onOpenChange={(open) => handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open: open })}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open}
                          className="w-full justify-between bg-white"
                        >
                          {point.point_id ? getPointDisplayName(point.point_id) : "Выберите пункт"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Поиск пункта..."
                            value={pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || ""}
                            onValueChange={(search) =>
                              handleSearchStateChange(`${tripIndex}-${pointIndex}`, { search: search })
                            }
                          />
                          <CommandList>
                            <CommandEmpty>Пункты не найдены</CommandEmpty>
                            <CommandGroup className="max-h-[200px] overflow-auto">
                              {filteredPoints(pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || "").map(
                                (p) => (
                                  <CommandItem
                                    key={p.point_id}
                                    value={`${p.point_id} ${p.point_name}`}
                                    onSelect={() => {
                                      updatePoint(tripIndex, pointIndex, "point_id", p.point_id)
                                      updatePoint(tripIndex, pointIndex, "point_name", p.point_name)
                                      updatePoint(tripIndex, pointIndex, "latitude", p.latitude)
                                      updatePoint(tripIndex, pointIndex, "longitude", p.longitude)
                                      handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open: false })
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span>{p.point_name}</span>
                                      <span className="text-xs text-gray-500">{p.point_id}</span>
                                    </div>
                                  </CommandItem>
                                ),
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => movePointUp(tripIndex, pointIndex)}
                    disabled={point.point_num === 1}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => movePointDown(tripIndex, pointIndex)}
                    disabled={point.point_num === trip.points.length}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removePoint(tripIndex, pointIndex)}
                    disabled={trip.points.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          <Button
            onClick={() => addNewPoint(tripIndex)}
            variant="outline"
            className="w-full text-blue-600 bg-transparent"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить пункт
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
