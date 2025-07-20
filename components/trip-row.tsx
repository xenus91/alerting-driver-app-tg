"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { PlusIcon, XIcon, ChevronDownIcon } from "lucide-react"
import type { Trip, Point } from "@/lib/database"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

interface TripRowProps {
  trip: Trip
  tripIndex: number
  points: Point[]
  filteredPoints: (search: string) => Point[]
  updateTrip: (field: keyof Trip, value: any) => void
  updatePoint: (pointIndex: number, field: keyof Point, value: any) => void
  addNewPoint: () => void
  removePoint: (pointIndex: number) => void
  removeTrip: () => void
  isRemovable: boolean
}

// Helper to format date-time for input type="datetime-local"
const formatDateTime = (dateString?: string | Date | null): string => {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "" // Invalid date

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function TripRow({
  trip,
  tripIndex,
  points,
  filteredPoints,
  updateTrip,
  updatePoint,
  addNewPoint,
  removePoint,
  removeTrip,
  isRemovable,
}: TripRowProps) {
  const [pointSearchStates, setPointSearchStates] = useState<Record<string, { search: string; open: boolean }>>({})

  const handlePointSearchChange = useCallback((pointId: string, search: string) => {
    setPointSearchStates((prev) => ({
      ...prev,
      [pointId]: { ...prev[pointId], search },
    }))
  }, [])

  const handlePointPopoverOpenChange = useCallback((pointId: string, open: boolean) => {
    setPointSearchStates((prev) => ({
      ...prev,
      [pointId]: { ...prev[pointId], open },
    }))
  }, [])

  const handlePointSelect = useCallback(
    (pointIndex: number, selectedPoint: Point) => {
      updatePoint(pointIndex, "point_id", selectedPoint.point_id)
      updatePoint(pointIndex, "point_name", selectedPoint.point_name)
      updatePoint(pointIndex, "address", selectedPoint.address)
      updatePoint(pointIndex, "latitude", selectedPoint.latitude)
      updatePoint(pointIndex, "longitude", selectedPoint.longitude)
      setPointSearchStates((prev) => ({
        ...prev,
        [selectedPoint.point_id]: {
          ...prev[selectedPoint.point_id],
          open: false,
          search: selectedPoint.point_name || "",
        },
      }))
    },
    [updatePoint],
  )

  return (
    <div className="border p-4 rounded-md mb-4 relative">
      {isRemovable && (
        <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={removeTrip}>
          <XIcon className="h-4 w-4" />
        </Button>
      )}
      <h4 className="text-md font-semibold mb-3">Рейс {tripIndex + 1}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label htmlFor={`trip_id-${tripIndex}`}>ID Рейса</Label>
          <Input
            id={`trip_id-${tripIndex}`}
            value={trip.trip_id || ""}
            onChange={(e) => updateTrip("trip_id", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`trip_identifier-${tripIndex}`}>Идентификатор</Label>
          <Input
            id={`trip_identifier-${tripIndex}`}
            value={trip.trip_identifier || ""}
            onChange={(e) => updateTrip("trip_identifier", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`car_number-${tripIndex}`}>Номер ТС</Label>
          <Input
            id={`car_number-${tripIndex}`}
            value={trip.car_number || ""}
            onChange={(e) => updateTrip("car_number", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`carpark-${tripIndex}`}>Автопарк</Label>
          <Input
            id={`carpark-${tripIndex}`}
            value={trip.carpark || ""}
            onChange={(e) => updateTrip("carpark", e.target.value)}
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
      </div>
      <div className="mb-4">
        <Label htmlFor={`comment-${tripIndex}`}>Комментарий</Label>
        <Textarea
          id={`comment-${tripIndex}`}
          value={trip.comment || ""}
          onChange={(e) => updateTrip("comment", e.target.value)}
        />
      </div>

      <h5 className="text-md font-semibold mb-2">Точки маршрута</h5>
      {trip.points.map((point, pointIndex) => (
        <div key={pointIndex} className="border p-3 rounded-md mb-3 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => removePoint(pointIndex)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
          <h6 className="text-sm font-medium mb-2">Точка {pointIndex + 1}</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`point_name-${tripIndex}-${pointIndex}`}>Название точки</Label>
              <Popover
                open={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open}
                onOpenChange={(open) => handlePointPopoverOpenChange(`${tripIndex}-${pointIndex}`, open)}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open}
                    className="w-full justify-between bg-transparent"
                  >
                    {point.point_name || "Выберите точку..."}
                    <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Поиск точки..."
                      value={pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || ""}
                      onValueChange={(search) => handlePointSearchChange(`${tripIndex}-${pointIndex}`, search)}
                    />
                    <CommandList>
                      <CommandEmpty>Точка не найдена.</CommandEmpty>
                      <CommandGroup>
                        {filteredPoints(pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || "").map((p) => (
                          <CommandItem
                            key={p.point_id}
                            value={p.point_name || p.address || String(p.point_id)}
                            onSelect={() => handlePointSelect(pointIndex, p)}
                          >
                            {p.point_name} ({p.address})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor={`point_id-${tripIndex}-${pointIndex}`}>ID Точки</Label>
              <Input
                id={`point_id-${tripIndex}-${pointIndex}`}
                value={point.point_id || ""}
                onChange={(e) => updatePoint(pointIndex, "point_id", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`address-${tripIndex}-${pointIndex}`}>Адрес</Label>
              <Input
                id={`address-${tripIndex}-${pointIndex}`}
                value={point.address || ""}
                onChange={(e) => updatePoint(pointIndex, "address", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`latitude-${tripIndex}-${pointIndex}`}>Широта</Label>
              <Input
                id={`latitude-${tripIndex}-${pointIndex}`}
                type="number"
                value={point.latitude ?? ""}
                onChange={(e) => updatePoint(pointIndex, "latitude", Number.parseFloat(e.target.value) || null)}
              />
            </div>
            <div>
              <Label htmlFor={`longitude-${tripIndex}-${pointIndex}`}>Долгота</Label>
              <Input
                id={`longitude-${tripIndex}-${pointIndex}`}
                type="number"
                value={point.longitude ?? ""}
                onChange={(e) => updatePoint(pointIndex, "longitude", Number.parseFloat(e.target.value) || null)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={`point_comment-${tripIndex}-${pointIndex}`}>Комментарий точки</Label>
              <Textarea
                id={`point_comment-${tripIndex}-${pointIndex}`}
                value={point.comment || ""}
                onChange={(e) => updatePoint(pointIndex, "comment", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full mt-3 bg-transparent" onClick={addNewPoint}>
        <PlusIcon className="mr-2 h-4 w-4" /> Добавить точку
      </Button>
    </div>
  )
}
