"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronsUpDown, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { useCallback } from "react"
import type { CorrectionData, PointData } from "./trip-correction-modal" // Import interfaces

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
  correctionsLength: number // Total number of trips in the current group
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
      return availablePoints.filter(
        (point) =>
          point.point_id.toLowerCase().includes(search.toLowerCase()) ||
          (point.point_name || "").toLowerCase().includes(search.toLowerCase()),
      )
    },
    [availablePoints],
  )

  return (
    <div className="border p-4 rounded-lg shadow-sm bg-white">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-md">Рейс #{tripIndex + 1}</h4>
        {correctionsLength > 1 && (
          <Button variant="destructive" size="sm" onClick={removeTrip}>
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить рейс
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label htmlFor={`trip_identifier-${tripIndex}`}>Номер рейса</Label>
          <Input
            id={`trip_identifier-${tripIndex}`}
            value={trip.trip_identifier}
            onChange={(e) => updateTrip("trip_identifier", e.target.value)}
            placeholder="Введите номер рейса"
          />
        </div>
        <div>
          <Label htmlFor={`vehicle_number-${tripIndex}`}>Номер ТС</Label>
          <Input
            id={`vehicle_number-${tripIndex}`}
            value={trip.vehicle_number}
            onChange={(e) => updateTrip("vehicle_number", e.target.value)}
            placeholder="Введите номер ТС"
          />
        </div>
        <div>
          <Label htmlFor={`planned_loading_time-${tripIndex}`}>Плановое время погрузки</Label>
          <Input
            id={`planned_loading_time-${tripIndex}`}
            type="datetime-local"
            value={formatDateTime(trip.planned_loading_time)}
            onChange={(e) => updateTrip("planned_loading_time", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`driver_comment-${tripIndex}`}>Комментарий водителя</Label>
          <Textarea
            id={`driver_comment-${tripIndex}`}
            value={trip.driver_comment || ""}
            onChange={(e) => updateTrip("driver_comment", e.target.value)}
            placeholder="Добавьте комментарий для водителя"
          />
        </div>
      </div>

      <h5 className="font-semibold text-md mb-3">Точки маршрута:</h5>
      <div className="space-y-4">
        {trip.points.map((point, pointIndex) => (
          <div key={pointIndex} className="border p-3 rounded-md bg-gray-100 relative">
            <div className="absolute top-2 right-2 flex gap-1">
              {pointIndex > 0 && (
                <Button variant="ghost" size="icon" onClick={() => movePointUp(pointIndex)} title="Переместить вверх">
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
              {pointIndex < trip.points.length - 1 && (
                <Button variant="ghost" size="icon" onClick={() => movePointDown(pointIndex)} title="Переместить вниз">
                  <ArrowDown className="h-4 w-4" />
                </Button>
              )}
              {trip.points.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removePoint(pointIndex)} title="Удалить точку">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-10">
              <div>
                <Label htmlFor={`point_type-${tripIndex}-${pointIndex}`}>Тип точки</Label>
                <Select
                  value={point.point_type}
                  onValueChange={(value: "P" | "D") => updatePoint(pointIndex, "point_type", value)}
                >
                  <SelectTrigger id={`point_type-${tripIndex}-${pointIndex}`}>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P">Погрузка</SelectItem>
                    <SelectItem value="D">Выгрузка</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`point_num-${tripIndex}-${pointIndex}`}>Порядковый номер</Label>
                <Input
                  id={`point_num-${tripIndex}-${pointIndex}`}
                  type="number"
                  value={point.point_num}
                  onChange={(e) => updatePoint(pointIndex, "point_num", Number.parseInt(e.target.value) || 0)}
                  readOnly // Point num is managed by move/remove functions
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor={`point_id-${tripIndex}-${pointIndex}`}>ID точки / Название</Label>
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
                        : "Выберите точку или введите ID"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Поиск по ID или названию..."
                        value={pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || ""}
                        onChange={(e) =>
                          handleSearchStateChange(`${tripIndex}-${pointIndex}`, { search: e.target.value })
                        }
                      />
                      <CommandList>
                        <CommandEmpty>Точки не найдены</CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-auto">
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
                                  handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open: false })
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
                {/* Fallback input for manual entry if not selected from list */}
                {!point.point_id && (
                  <Input
                    className="mt-2"
                    placeholder="Введите ID точки вручную"
                    value={point.point_id}
                    onChange={(e) => updatePoint(pointIndex, "point_id", e.target.value)}
                  />
                )}
              </div>
              <div>
                <Label htmlFor={`latitude-${tripIndex}-${pointIndex}`}>Широта</Label>
                <Input
                  id={`latitude-${tripIndex}-${pointIndex}`}
                  value={point.latitude || ""}
                  onChange={(e) => updatePoint(pointIndex, "latitude", e.target.value)}
                  placeholder="Введите широту"
                />
              </div>
              <div>
                <Label htmlFor={`longitude-${tripIndex}-${pointIndex}`}>Долгота</Label>
                <Input
                  id={`longitude-${tripIndex}-${pointIndex}`}
                  value={point.longitude || ""}
                  onChange={(e) => updatePoint(pointIndex, "longitude", e.target.value)}
                  placeholder="Введите долготу"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-4">
        <Button onClick={addNewPoint} variant="outline" className="text-blue-600 bg-transparent">
          <Plus className="h-4 w-4 mr-2" />
          Добавить точку
        </Button>
      </div>
    </div>
  )
}
