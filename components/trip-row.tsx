"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ArrowDown,
  ArrowUp,
  CalendarIcon,
  Car,
  ChevronsUpDown,
  MapPin,
  MessageSquare,
  MinusCircle,
  PlusCircle,
  Trash2,
} from "lucide-react"

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
  const filteredPoints = (search: string) =>
    availablePoints.filter(
      (point) =>
        point.point_id.toLowerCase().includes(search.toLowerCase()) ||
        (point.point_name || "").toLowerCase().includes(search.toLowerCase()),
    )

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          Рейс {tripIndex + 1}
          {trip.original_trip_identifier && (
            <span className="text-sm text-gray-500">(Оригинал: {trip.original_trip_identifier})</span>
          )}
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
          <div>
            <Label htmlFor={`trip-identifier-${tripIndex}`}>Идентификатор рейса</Label>
            <div className="relative">
              <Car className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id={`trip-identifier-${tripIndex}`}
                value={trip.trip_identifier}
                onChange={(e) => updateTrip("trip_identifier", e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`vehicle-number-${tripIndex}`}>Номер ТС</Label>
            <div className="relative">
              <Car className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id={`vehicle-number-${tripIndex}`}
                value={trip.vehicle_number}
                onChange={(e) => updateTrip("vehicle_number", e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`planned-loading-time-${tripIndex}`}>Плановое время погрузки</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id={`planned-loading-time-${tripIndex}`}
                type="datetime-local"
                value={formatDateTime(trip.planned_loading_time)}
                onChange={(e) => updateTrip("planned_loading_time", formatDateTimeForSave(e.target.value))}
                className="pl-8"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor={`driver-comment-${tripIndex}`}>Комментарий водителя</Label>
            <div className="relative">
              <MessageSquare className="absolute left-2 top-3 h-4 w-4 text-gray-500" />
              <Textarea
                id={`driver-comment-${tripIndex}`}
                value={trip.driver_comment || ""}
                onChange={(e) => updateTrip("driver_comment", e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        <h4 className="font-semibold text-md mt-6 mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-700" />
          Точки маршрута
        </h4>
        <div className="space-y-4">
          {trip.points.map((point, pointIndex) => (
            <Card key={pointIndex} className="p-4 border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-sm">Точка {point.point_num}</h5>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => movePointUp(pointIndex)}
                    disabled={point.point_num === 1}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => movePointDown(pointIndex)}
                    disabled={point.point_num === trip.points.length}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {trip.points.length > 1 && (
                    <Button variant="destructive" size="sm" onClick={() => removePoint(pointIndex)}>
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`point-type-${tripIndex}-${pointIndex}`}>Тип точки</Label>
                  <Select
                    value={point.point_type}
                    onValueChange={(value: "P" | "D") => updatePoint(pointIndex, "point_type", value)}
                  >
                    <SelectTrigger id={`point-type-${tripIndex}-${pointIndex}`}>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P">Погрузка</SelectItem>
                      <SelectItem value="D">Выгрузка</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
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
                          ? availablePoints.find((p) => p.point_id === point.point_id)?.point_name || point.point_id
                          : "Выберите точку"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Поиск точки..."
                          value={pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || ""}
                          onValueChange={(value) =>
                            handleSearchStateChange(`${tripIndex}-${pointIndex}`, { search: value })
                          }
                        />
                        <CommandList>
                          <CommandEmpty>Точки не найдены</CommandEmpty>
                          <CommandGroup className="max-h-[200px] overflow-auto">
                            {filteredPoints(pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || "").map((p) => (
                              <CommandItem
                                key={p.point_id}
                                value={`${p.point_id} ${p.point_name}`}
                                onSelect={() => {
                                  updatePoint(pointIndex, "point_id", p.point_id)
                                  updatePoint(pointIndex, "point_name", p.point_name)
                                  updatePoint(pointIndex, "latitude", p.latitude)
                                  updatePoint(pointIndex, "longitude", p.longitude)
                                  handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open: false })
                                }}
                              >
                                <div className="flex flex-col">
                                  <span>{p.point_name}</span>
                                  <span className="text-sm text-gray-500">{p.point_id}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor={`point-name-${tripIndex}-${pointIndex}`}>Название точки</Label>
                  <Input
                    id={`point-name-${tripIndex}-${pointIndex}`}
                    value={point.point_name || ""}
                    onChange={(e) => updatePoint(pointIndex, "point_name", e.target.value)}
                    disabled // Usually derived from point_id selection
                  />
                </div>
                <div>
                  <Label htmlFor={`latitude-${tripIndex}-${pointIndex}`}>Широта</Label>
                  <Input
                    id={`latitude-${tripIndex}-${pointIndex}`}
                    value={point.latitude || ""}
                    onChange={(e) => updatePoint(pointIndex, "latitude", e.target.value)}
                    disabled // Usually derived from point_id selection
                  />
                </div>
                <div>
                  <Label htmlFor={`longitude-${tripIndex}-${pointIndex}`}>Долгота</Label>
                  <Input
                    id={`longitude-${tripIndex}-${pointIndex}`}
                    value={point.longitude || ""}
                    onChange={(e) => updatePoint(pointIndex, "longitude", e.target.value)}
                    disabled // Usually derived from point_id selection
                  />
                </div>
              </div>
            </Card>
          ))}
          <div className="flex justify-center mt-4">
            <Button onClick={addNewPoint} variant="outline" className="text-blue-600 bg-transparent">
              <PlusCircle className="h-4 w-4 mr-2" />
              Добавить точку
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
