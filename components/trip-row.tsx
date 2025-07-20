"use client"

import { useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  MapPin,
  Truck,
  MessageSquare,
  Hash,
  CircleDot,
  CircleDashed,
  XCircle,
  CalendarDays,
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
  updateTrip: (field: keyof CorrectionData, value: any) => void
  movePointUp: (pointIndex: number) => void
  movePointDown: (pointIndex: number) => void
  updatePoint: (pointIndex: number, field: keyof PointData, value: any) => void
  addNewPoint: () => void
  removePoint: (pointIndex: number) => void
  removeTrip: () => void
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
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5 text-gray-600" />
          Рейс {tripIndex + 1}
        </CardTitle>
        {correctionsLength > 1 && (
          <Button variant="destructive" size="sm" onClick={removeTrip}>
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить рейс
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`trip-identifier-${tripIndex}`}>
              <Hash className="inline-block h-4 w-4 mr-1 text-gray-500" />
              Номер рассылки
            </Label>
            <Input
              id={`trip-identifier-${tripIndex}`}
              value={trip.trip_identifier}
              onChange={(e) => updateTrip("trip_identifier", e.target.value)}
              placeholder="Введите номер рассылки"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`vehicle-number-${tripIndex}`}>
              <Truck className="inline-block h-4 w-4 mr-1 text-gray-500" />
              Номер ТС
            </Label>
            <Input
              id={`vehicle-number-${tripIndex}`}
              value={trip.vehicle_number}
              onChange={(e) => updateTrip("vehicle_number", e.target.value)}
              placeholder="Введите номер ТС"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`planned-loading-time-${tripIndex}`}>
              <CalendarDays className="inline-block h-4 w-4 mr-1 text-gray-500" />
              Плановое время погрузки
            </Label>
            <Input
              id={`planned-loading-time-${tripIndex}`}
              type="datetime-local"
              value={formatDateTime(trip.planned_loading_time)}
              onChange={(e) => updateTrip("planned_loading_time", formatDateTimeForSave(e.target.value))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`driver-comment-${tripIndex}`}>
              <MessageSquare className="inline-block h-4 w-4 mr-1 text-gray-500" />
              Комментарий водителя
            </Label>
            <Textarea
              id={`driver-comment-${tripIndex}`}
              value={trip.driver_comment || ""}
              onChange={(e) => updateTrip("driver_comment", e.target.value)}
              placeholder="Добавьте комментарий для водителя"
            />
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <h4 className="text-md font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            Точки маршрута
          </h4>
          {trip.points
            .sort((a, b) => a.point_num - b.point_num)
            .map((point, pointIndex) => (
              <div key={pointIndex} className="border rounded-md p-3 bg-gray-50 relative">
                <div className="absolute top-2 right-2 flex gap-1">
                  {pointIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => movePointUp(pointIndex)}
                      className="h-7 w-7"
                      title="Переместить вверх"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                  {pointIndex < trip.points.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => movePointDown(pointIndex)}
                      className="h-7 w-7"
                      title="Переместить вниз"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePoint(pointIndex)}
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    title="Удалить точку"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`point-type-${tripIndex}-${pointIndex}`}>Тип точки</Label>
                    <Select
                      value={point.point_type}
                      onValueChange={(value: "P" | "D") => updatePoint(pointIndex, "point_type", value)}
                    >
                      <SelectTrigger id={`point-type-${tripIndex}-${pointIndex}`}>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="P">
                          <CircleDot className="inline-block h-4 w-4 mr-2 text-green-500" />
                          Погрузка
                        </SelectItem>
                        <SelectItem value="D">
                          <CircleDashed className="inline-block h-4 w-4 mr-2 text-red-500" />
                          Выгрузка
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`point-num-${tripIndex}-${pointIndex}`}>Номер точки</Label>
                    <Input
                      id={`point-num-${tripIndex}-${pointIndex}`}
                      type="number"
                      value={point.point_num}
                      onChange={(e) => updatePoint(pointIndex, "point_num", Number.parseInt(e.target.value))}
                      readOnly // Point number is managed by sorting/recalculation
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`point-id-${tripIndex}-${pointIndex}`}>ID точки</Label>
                    <Popover
                      open={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open}
                      onOpenChange={(open) => handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open })}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open}
                          className="w-full justify-between bg-transparent"
                        >
                          {point.point_id
                            ? `${point.point_id} - ${point.point_name || "Без названия"}`
                            : "Выберите точку"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Поиск по ID или названию..."
                            value={pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || ""}
                            onValueChange={(value) =>
                              handleSearchStateChange(`${tripIndex}-${pointIndex}`, { search: value })
                            }
                          />
                          <CommandList>
                            <CommandEmpty>Точки не найдены</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-auto">
                              {filteredPoints(pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || "").map(
                                (availablePoint) => (
                                  <CommandItem
                                    key={availablePoint.point_id}
                                    value={`${availablePoint.point_id} ${availablePoint.point_name}`}
                                    onSelect={() => {
                                      updatePoint(pointIndex, "point_id", availablePoint.point_id)
                                      updatePoint(pointIndex, "point_name", availablePoint.point_name)
                                      updatePoint(pointIndex, "latitude", availablePoint.latitude)
                                      updatePoint(pointIndex, "longitude", availablePoint.longitude)
                                      handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open: false, search: "" })
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span>{availablePoint.point_id}</span>
                                      <span className="text-sm text-gray-500">{availablePoint.point_name}</span>
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
                  <div className="space-y-2">
                    <Label htmlFor={`point-name-${tripIndex}-${pointIndex}`}>Название точки</Label>
                    <Input
                      id={`point-name-${tripIndex}-${pointIndex}`}
                      value={point.point_name || ""}
                      onChange={(e) => updatePoint(pointIndex, "point_name", e.target.value)}
                      placeholder="Название точки"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`latitude-${tripIndex}-${pointIndex}`}>Широта</Label>
                    <Input
                      id={`latitude-${tripIndex}-${pointIndex}`}
                      value={point.latitude || ""}
                      onChange={(e) => updatePoint(pointIndex, "latitude", e.target.value)}
                      placeholder="Широта"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`longitude-${tripIndex}-${pointIndex}`}>Долгота</Label>
                    <Input
                      id={`longitude-${tripIndex}-${pointIndex}`}
                      value={point.longitude || ""}
                      onChange={(e) => updatePoint(pointIndex, "longitude", e.target.value)}
                      placeholder="Долгота"
                    />
                  </div>
                </div>
              </div>
            ))}
          <Button onClick={addNewPoint} variant="outline" className="w-full text-blue-600 bg-transparent">
            <Plus className="h-4 w-4 mr-2" />
            Добавить новую точку
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
