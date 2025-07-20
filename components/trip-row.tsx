"use client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowDown, ArrowUp, Plus, Trash2, X, ChevronsUpDown } from "lucide-react"
import { Separator } from "@/components/ui/separator"

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
  const getPointDisplayName = (point: PointData) => {
    return point.point_name && point.point_name !== "" ? point.point_name : point.point_id
  }

  return (
    <div className="border p-4 rounded-lg shadow-sm bg-white relative">
      {correctionsLength > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
          onClick={removeTrip}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label htmlFor={`trip_identifier-${tripIndex}`}>Номер рассылки</Label>
          <Input
            id={`trip_identifier-${tripIndex}`}
            value={trip.trip_identifier}
            onChange={(e) => updateTrip("trip_identifier", e.target.value)}
            placeholder="Например, 12345"
          />
        </div>
        <div>
          <Label htmlFor={`vehicle_number-${tripIndex}`}>Номер ТС</Label>
          <Input
            id={`vehicle_number-${tripIndex}`}
            value={trip.vehicle_number}
            onChange={(e) => updateTrip("vehicle_number", e.target.value)}
            placeholder="Например, АВ1234ВГ"
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
          <Label htmlFor={`driver_comment-${tripIndex}`}>Комментарий для водителя</Label>
          <Textarea
            id={`driver_comment-${tripIndex}`}
            value={trip.driver_comment || ""}
            onChange={(e) => updateTrip("driver_comment", e.target.value)}
            placeholder="Дополнительная информация для водителя"
            rows={2}
          />
        </div>
      </div>

      <Separator className="my-4" />

      <h4 className="font-semibold mb-3">Точки маршрута</h4>
      <div className="space-y-3">
        {trip.points.map((point, pointIndex) => (
          <div key={pointIndex} className="flex items-center gap-2 border p-3 rounded-md bg-gray-50">
            <div className="flex-shrink-0 w-6 text-center text-gray-600 font-medium">{point.point_num}</div>
            <Select
              value={point.point_type}
              onValueChange={(value: "P" | "D") => updatePoint(pointIndex, "point_type", value)}
            >
              <SelectTrigger className="w-[100px] flex-shrink-0">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P">Погрузка</SelectItem>
                <SelectItem value="D">Выгрузка</SelectItem>
              </SelectContent>
            </Select>

            <Popover
              open={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open || false}
              onOpenChange={(open) => handleSearchStateChange(`${tripIndex}-${pointIndex}`, { open })}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pointSearchStates[`${tripIndex}-${pointIndex}`]?.open || false}
                  className="flex-grow justify-between bg-white"
                >
                  {point.point_id ? getPointDisplayName(point) : "Выберите точку или введите ID"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput
                    placeholder="Поиск по ID или названию..."
                    value={pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || ""}
                    onValueChange={(search) => handleSearchStateChange(`${tripIndex}-${pointIndex}`, { search })}
                  />
                  <CommandList>
                    <CommandEmpty>Точки не найдены.</CommandEmpty>
                    <CommandGroup>
                      {availablePoints
                        .filter((ap) => {
                          const search = (pointSearchStates[`${tripIndex}-${pointIndex}`]?.search || "").toLowerCase()
                          return (
                            ap.point_id.toLowerCase().includes(search) ||
                            (ap.point_name || "").toLowerCase().includes(search)
                          )
                        })
                        .map((ap) => (
                          <CommandItem
                            key={ap.point_id}
                            value={`${ap.point_id} ${ap.point_name}`}
                            onSelect={() => {
                              updatePoint(pointIndex, "point_id", ap.point_id)
                              updatePoint(pointIndex, "point_name", ap.point_name)
                              updatePoint(pointIndex, "latitude", ap.latitude)
                              updatePoint(pointIndex, "longitude", ap.longitude)
                              handleSearchStateChange(`${tripIndex}-${pointIndex}`, {
                                open: false,
                                search: "",
                              })
                            }}
                          >
                            {ap.point_id} {ap.point_name && `(${ap.point_name})`}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Input
              className="flex-grow"
              placeholder="ID точки (если не из списка)"
              value={point.point_id}
              onChange={(e) => updatePoint(pointIndex, "point_id", e.target.value)}
            />
            <Input
              className="flex-grow"
              placeholder="Название точки (опционально)"
              value={point.point_name || ""}
              onChange={(e) => updatePoint(pointIndex, "point_name", e.target.value)}
            />
            <Input
              className="flex-grow"
              placeholder="Широта (опционально)"
              value={point.latitude || ""}
              onChange={(e) => updatePoint(pointIndex, "latitude", e.target.value)}
            />
            <Input
              className="flex-grow"
              placeholder="Долгота (опционально)"
              value={point.longitude || ""}
              onChange={(e) => updatePoint(pointIndex, "longitude", e.target.value)}
            />

            <div className="flex flex-col gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => movePointUp(pointIndex)} disabled={pointIndex === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => movePointDown(pointIndex)}
                disabled={pointIndex === trip.points.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removePoint(pointIndex)}
              disabled={trip.points.length === 1}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={addNewPoint} variant="outline" className="text-blue-600 bg-transparent">
          <Plus className="h-4 w-4 mr-2" />
          Добавить точку
        </Button>
      </div>
    </div>
  )
}
