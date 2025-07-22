"use client"

import { memo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Trash2, Check, ChevronsUpDown, Search, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

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

// === НОВОЕ: Обновленный интерфейс пропсов с добавлением driverIndex ===
interface TripRowProps {
  trip: CorrectionData
  tripIndex: number
  driverIndex: number // Добавляем driverIndex
  availablePoints: Array<{ point_id: string; point_name: string; latitude?: string; longitude?: string }>
  pointSearchStates: Record<string, { open: boolean; search: string }>
  handleSearchStateChange: (key: string, state: { open?: boolean; search?: string }) => void
  updateTrip: (driverIndex: number, tripIndex: number, field: keyof CorrectionData, value: any) => void
  updatePoint: (driverIndex: number, tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => void
  movePointUp: (driverIndex: number, tripIndex: number, pointIndex: number) => void
  movePointDown: (driverIndex: number, tripIndex: number, pointIndex: number) => void
  addNewPoint: (driverIndex: number, tripIndex: number) => void
  removePoint: (driverIndex: number, tripIndex: number, pointIndex: number) => void
  removeTrip: (driverIndex: number, tripIndex: number) => void
  correctionsLength: number
  formatDateTime: (dateString: string) => string
  formatDateTimeForSave: (dateString: string) => string
}

interface PointSelectorProps {
  value: string
  onChange: (point: { point_id: string; point_name: string; latitude?: string; longitude?: string }) => void
  pointKey: string
  availablePoints: Array<{ point_id: string; point_name: string; latitude?: string; longitude?: string }>
  searchState: { open: boolean; search: string }
  onSearchStateChange: (key: string, state: { open?: boolean; search?: string }) => void
}

const PointSelector = memo(
  ({ value, onChange, pointKey, availablePoints, searchState, onSearchStateChange }: PointSelectorProps) => {
    const filterPoints = useCallback(
      (searchTerm: string) => {
        if (!searchTerm) return availablePoints
        const lowerSearch = searchTerm.toLowerCase()
        return availablePoints.filter(
          (point) =>
            point.point_id.toLowerCase().includes(lowerSearch) || point.point_name.toLowerCase().includes(lowerSearch),
        )
      },
      [availablePoints],
    )

    const filteredPoints = filterPoints(searchState.search)
    const selectedPoint = availablePoints.find((p) => p.point_id === value)

    const handleOpenChange = useCallback(
      (open: boolean) => {
        onSearchStateChange(pointKey, { open, search: open ? searchState.search : "" })
      },
      [pointKey, onSearchStateChange, searchState.search],
    )

    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onSearchStateChange(pointKey, { search: e.target.value })
      },
      [pointKey, onSearchStateChange],
    )

    const handlePointSelect = useCallback(
      (point: { point_id: string; point_name: string; latitude?: string; longitude?: string }) => {
        onChange(point)
        onSearchStateChange(pointKey, { open: false, search: "" })
      },
      [pointKey, onChange, onSearchStateChange],
    )

    return (
      <Popover open={searchState.open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={searchState.open}
            className="w-full justify-between bg-transparent"
          >
            {selectedPoint ? (
              <div className="flex flex-col items-start">
                <span className="font-medium">{selectedPoint.point_id}</span>
                <span className="text-xs text-muted-foreground">{selectedPoint.point_name}</span>
              </div>
            ) : (
              "Выберите точку..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Поиск по коду или названию..."
              value={searchState.search}
              onChange={handleSearchChange}
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-auto">
            {filteredPoints.length === 0 ? (
              <div className="py-6 text-center text-sm">
                {searchState.search ? "Точки не найдены." : "Введите текст для поиска"}
              </div>
            ) : (
              filteredPoints.map((point) => (
                <div
                  key={point.point_id}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === point.point_id && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => handlePointSelect(point)}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === point.point_id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{point.point_id}</span>
                    <span className="text-sm text-muted-foreground">{point.point_name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)
PointSelector.displayName = "PointSelector"

export const TripRow = memo(
  ({
    trip,
    tripIndex,
    driverIndex, // Добавляем driverIndex
    availablePoints,
    pointSearchStates,
    handleSearchStateChange,
    updateTrip,
    updatePoint,
    movePointUp,
    movePointDown,
    addNewPoint,
    removePoint,
    removeTrip,
    correctionsLength,
    formatDateTime,
    formatDateTimeForSave,
  }: TripRowProps) => {
    // === ИЗМЕНЕНО: Удален неиспользуемый useRef и useEffect ===
    // Сортировка точек по point_num
    const sortedPoints = [...trip.points].sort((a, b) => a.point_num - b.point_num)

    // === НОВОЕ: Уникальный ключ для точки ===
    const getPointKey = useCallback(
      (point: PointData, index: number) =>
        `${driverIndex}-${trip.original_trip_identifier || `trip-${tripIndex}`}-${point.point_type}-${point.point_num}-${point.point_id}-${index}`,
      [driverIndex, trip.original_trip_identifier, tripIndex],
    )

    // === ИЗМЕНЕНО: Упрощенная функция для получения оригинального индекса ===
    const getOriginalIndex = useCallback(
      (sortedIndex: number) => {
        const sortedPoint = sortedPoints[sortedIndex]
        const originalIndex = trip.points.findIndex(
          (p) =>
            p.point_num === sortedPoint.point_num &&
            p.point_id === sortedPoint.point_id &&
            p.point_type === sortedPoint.point_type,
        )
        console.log(`📍 getOriginalIndex: sortedIndex=${sortedIndex} -> originalIndex=${originalIndex}`)
        return originalIndex !== -1 ? originalIndex : sortedIndex
      },
      [sortedPoints, trip.points],
    )

    // === ИЗМЕНЕНО: Упрощенные функции проверки перемещения ===
    const canMoveUp = useCallback(
      (sortedIndex: number) => {
        const point = sortedPoints[sortedIndex]
        return point.point_num > 1
      },
      [sortedPoints],
    )

    const canMoveDown = useCallback(
      (sortedIndex: number) => {
        const point = sortedPoints[sortedIndex]
        return point.point_num < sortedPoints.length
      },
      [sortedPoints],
    )

    return (
      <div key={trip.original_trip_identifier || `trip-${tripIndex}`} className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Рейс {trip.trip_identifier || `Новый ${tripIndex + 1}`}</h3>
          {correctionsLength > 1 && (
            <Button onClick={() => removeTrip(driverIndex, tripIndex)} variant="outline" size="sm" className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить рейс
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium">Номер рейса</label>
            <Input
              value={trip.trip_identifier || ""}
              onChange={(e) => updateTrip(driverIndex, tripIndex, "trip_identifier", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Транспорт</label>
            <Input
              value={trip.vehicle_number || ""}
              onChange={(e) => updateTrip(driverIndex, tripIndex, "vehicle_number", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Время погрузки</label>
            <Input
              type="datetime-local"
              value={formatDateTime(trip.planned_loading_time || "")}
              onChange={(e) => updateTrip(driverIndex, tripIndex, "planned_loading_time", formatDateTimeForSave(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Комментарий</label>
            <Input
              value={trip.driver_comment || ""}
              onChange={(e) => updateTrip(driverIndex, tripIndex, "driver_comment", e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Тип</TableHead>
              <TableHead>№</TableHead>
              <TableHead>Точка</TableHead>
              <TableHead>Порядок</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPoints.map((point, sortedIndex) => {
              const originalIndex = getOriginalIndex(sortedIndex)
              const pointKey = getPointKey(point, sortedIndex)

              return (
                <TableRow key={pointKey}>
                  <TableCell>
                    <Select
                      value={point.point_type}
                      onValueChange={(value: "P" | "D") => updatePoint(driverIndex, tripIndex, originalIndex, "point_type", value)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="P">
                          <Badge variant="outline" className="bg-blue-100 text-blue-600">
                            P
                          </Badge>
                        </SelectItem>
                        <SelectItem value="D">
                          <Badge variant="outline" className="bg-green-100 text-green-600">
                            D
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center h-full">
                      <span className="font-medium">{point.point_num}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PointSelector
                      value={point.point_id}
                      onChange={(selectedPoint) => {
                        updatePoint(driverIndex, tripIndex, originalIndex, "point_id", selectedPoint.point_id)
                        updatePoint(driverIndex, tripIndex, originalIndex, "point_name", selectedPoint.point_name)
                        updatePoint(driverIndex, tripIndex, originalIndex, "latitude", selectedPoint.latitude)
                        updatePoint(driverIndex, tripIndex, originalIndex, "longitude", selectedPoint.longitude)
                      }}
                      pointKey={pointKey}
                      availablePoints={availablePoints}
                      searchState={pointSearchStates[pointKey] || { open: false, search: "" }}
                      onSearchStateChange={handleSearchStateChange}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-center">
                      {canMoveUp(sortedIndex) && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => movePointUp(driverIndex, tripIndex, originalIndex)}
                          title="Переместить вверх"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      )}
                      {canMoveDown(sortedIndex) && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => movePointDown(driverIndex, tripIndex, originalIndex)}
                          title="Переместить вниз"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => removePoint(driverIndex, tripIndex, originalIndex)}
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {/* === НОВОЕ: Кнопка "Добавить точку" перенесена под таблицу и центрирована === */}
        <div className="flex justify-center mt-4">
          <Button onClick={() => addNewPoint(driverIndex, tripIndex)} variant="outline" className="text-blue-600">
            <Plus className="h-4 w-4 mr-2" />
            Добавить точку
          </Button>
        </div>
      </div>
    )
  },
)
TripRow.displayName = "TripRow"
