import { memo, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Trash2, Check, ChevronsUpDown, X , Search } from "lucide-react"
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
        if (open) {
          onSearchStateChange(pointKey, { open: true, search: "" })
        } else {
          onSearchStateChange(pointKey, { open: false, search: "" })
        }
      },
      [pointKey, onSearchStateChange],
    )

    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearch = e.target.value
        onSearchStateChange(pointKey, { search: newSearch })
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
          <Button variant="outline" role="combobox" aria-expanded={searchState.open} className="w-full justify-between">
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
    availablePoints,
    pointSearchStates,
    handleSearchStateChange,
    updateTrip,
    updatePoint,
    addNewPoint,
    removePoint,
    removeTrip,
    correctionsLength,
    formatDateTime,
    formatDateTimeForSave,
  }: {
    trip: CorrectionData
    tripIndex: number
    availablePoints: Array<{ point_id: string; point_name: string; latitude?: string; longitude?: string }>
    pointSearchStates: Record<string, { open: boolean; search: string }>
    handleSearchStateChange: (key: string, state: { open?: boolean; search?: string }) => void
    updateTrip: (tripIndex: number, field: keyof CorrectionData, value: any) => void
    updatePoint: (tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => void
    addNewPoint: (tripIndex: number) => void
    removePoint: (tripIndex: number, pointIndex: number) => void
    removeTrip: (tripIndex: number) => void
    correctionsLength: number
    formatDateTime: (dateString: string) => string
    formatDateTimeForSave: (dateString: string) => string
  }) => {
    const inputRef = useRef<HTMLInputElement>(null)

    // Функция для сортировки точек
    const sortPoints = (points: PointData[]): PointData[] => {
      return [...points].sort((a, b) => {
        // Сначала сортируем по типу: 'P' перед 'D'
        if (a.point_type !== b.point_type) {
          return a.point_type === "P" ? -1 : 1;
        }
        // Затем сортируем по point_num по возрастанию
        return a.point_num - b.point_num;
      });
    }; 

        // Создаем отсортированную версию точек для отображения
    const sortedPoints = sortPoints(trip.points);

    useEffect(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.focus()
      }
    }, [trip.trip_identifier])

    const getPointKey = (tripIdentifier: string, pointType: string, pointNum: number) =>
      `${trip.original_trip_identifier || `trip-${tripIndex}`}-${pointType}-${pointNum}`

    return (
      <div key={trip.original_trip_identifier || `trip-${tripIndex}`} className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Рейс {trip.trip_identifier || `Новый ${tripIndex + 1}`}</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => addNewPoint(tripIndex)}
              variant="outline"
              size="sm"
              className="text-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить точку
            </Button>
            {correctionsLength > 1 && (
              <Button
                onClick={() => removeTrip(tripIndex)}
                variant="outline"
                size="sm"
                className="text-red-600"
              >
                <X className="h-4 w-4 mr-2" />
                Удалить рейс
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium">Номер рейса</label>
            <Input
              ref={inputRef}
              value={trip.trip_identifier || ""}
              onChange={(e) => {
                console.log("Updating trip_identifier:", e.target.value)
                updateTrip(tripIndex, "trip_identifier", e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Транспорт</label>
            <Input
              value={trip.vehicle_number || ""}
              onChange={(e) => updateTrip(tripIndex, "vehicle_number", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Время погрузки</label>
            <Input
              type="datetime-local"
              value={formatDateTime(trip.planned_loading_time || "")}
              onChange={(e) => updateTrip(tripIndex, "planned_loading_time", formatDateTimeForSave(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Комментарий</label>
            <Input
              value={trip.driver_comment || ""}
              onChange={(e) => updateTrip(tripIndex, "driver_comment", e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Тип</TableHead>
              <TableHead>№</TableHead>
              <TableHead>Точка</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Используем отсортированный массив для отображения */}
            {sortedPoints.map((point) => {
              // Находим индекс точки в оригинальном массиве
              const originalIndex = trip.points.findIndex(
                p => p.point_type === point.point_type && 
                     p.point_num === point.point_num && 
                     p.point_id === point.point_id
              );
              const pointKey = getPointKey(trip.trip_identifier, point.point_type, point.point_num)
              return (
                <TableRow key={`${trip.original_trip_identifier || `trip-${tripIndex}`}-${point.point_type}-${point.point_num}`}>
                  <TableCell>
                    <Select
                      value={point.point_type}
                      onValueChange={(value: "P" | "D") => updatePoint(tripIndex, originalIndex, "point_type", value)}
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
                    <Input
                      type="number"
                      value={point.point_num}
                      onChange={(e) => updatePoint(tripIndex, originalIndex, "point_num", Number.parseInt(e.target.value))}
                      className="w-16"
                    />
                  </TableCell>
                  <TableCell>
                    <PointSelector
                      value={point.point_id}
                      onChange={(selectedPoint) => {
                        updatePoint(tripIndex, originalIndex, "point_id", selectedPoint.point_id)
                        updatePoint(tripIndex, originalIndex, "point_name", selectedPoint.point_name)
                        updatePoint(tripIndex, originalIndex, "latitude", selectedPoint.latitude)
                        updatePoint(tripIndex, originalIndex, "longitude", selectedPoint.longitude)
                      }}
                      pointKey={pointKey}
                      availablePoints={availablePoints}
                      searchState={pointSearchStates[pointKey] || { open: false, search: "" }}
                      onSearchStateChange={handleSearchStateChange}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => removePoint(tripIndex, originalIndex)}
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
      </div>
    )
  },
)
TripRow.displayName = "TripRow"
