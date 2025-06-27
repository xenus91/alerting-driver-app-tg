"use client"

import React, { useState, useEffect, useCallback, memo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RefreshCw, Save, Send, Plus, Trash2, AlertTriangle, X, Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface CorrectionData {
  phone: string
  trip_identifier: string
  original_trip_identifier?: string
  vehicle_number: string
  planned_loading_time: string
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name?: string
  driver_comment?: string
  message_id: number
}

interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  phone: string
  driverName: string
  onCorrectionSent: () => void
}

const PointSelector = memo(
  ({
    value,
    onChange,
    pointKey,
    availablePoints,
    searchState,
    onSearchStateChange,
  }: {
    value: string
    onChange: (point: { point_id: string; point_name: string }) => void
    pointKey: string
    availablePoints: Array<{ point_id: string; point_name: string }>
    searchState: { open: boolean; search: string }
    onSearchStateChange: (key: string, state: { open?: boolean; search?: string }) => void
  }) => {
    const filterPoints = useCallback(
      (searchTerm: string) => {
        if (!searchTerm) return availablePoints
        const lowerSearch = searchTerm.toLowerCase()
        return availablePoints.filter(
          point => 
            point.point_id.toLowerCase().includes(lowerSearch) || 
            point.point_name?.toLowerCase().includes(lowerSearch)
        )
      },
      [availablePoints]
    )

    const filteredPoints = filterPoints(searchState.search)
    const selectedPoint = availablePoints.find(p => p.point_id === value)

    const handleOpenChange = useCallback(
      (open: boolean) => {
        onSearchStateChange(pointKey, { 
          open, 
          search: open ? "" : searchState.search 
        })
      },
      [pointKey, onSearchStateChange, searchState.search]
    )

    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onSearchStateChange(pointKey, { search: e.target.value })
      },
      [pointKey, onSearchStateChange]
    )

    const handlePointSelect = useCallback(
      (point: { point_id: string; point_name: string }) => {
        onChange(point)
        onSearchStateChange(pointKey, { open: false })
      },
      [onChange, pointKey, onSearchStateChange]
    )

    return (
      <Popover open={searchState.open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {selectedPoint ? (
              <div className="flex flex-col items-start truncate">
                <span className="font-medium truncate">{selectedPoint.point_id}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {selectedPoint.point_name}
                </span>
              </div>
            ) : (
              <span className="truncate">Выберите точку...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Поиск по коду или названию..."
              value={searchState.search}
              onChange={handleSearchChange}
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {filteredPoints.length === 0 ? (
              <div className="py-6 text-center text-sm">
                {searchState.search ? "Точки не найдены" : "Введите текст для поиска"}
              </div>
            ) : (
              filteredPoints.map(point => (
                <div
                  key={point.point_id}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === point.point_id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handlePointSelect(point)}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === point.point_id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col truncate">
                    <span className="font-medium truncate">{point.point_id}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {point.point_name}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)

PointSelector.displayName = "PointSelector"

export function TripCorrectionModal({
  isOpen,
  onClose,
  tripId,
  phone,
  driverName,
  onCorrectionSent,
}: TripCorrectionModalProps) {
  const [corrections, setCorrections] = useState<CorrectionData[]>([])
  const [deletedTrips, setDeletedTrips] = useState<string[]>([])
  const [availablePoints, setAvailablePoints] = useState<Array<{ point_id: string; point_name: string }>>([])
  const [pointSearchStates, setPointSearchStates] = useState<Record<string, { open: boolean; search: string }>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadDriverDetails()
      loadAvailablePoints()
    } else {
      // Сброс состояний при закрытии
      setCorrections([])
      setDeletedTrips([])
      setPointSearchStates({})
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  const loadDriverDetails = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/driver-details?phone=${encodeURIComponent(phone)}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to load driver details")

      const correctionsWithOriginal = data.data.map((item: CorrectionData) => ({
        ...item,
        original_trip_identifier: item.trip_identifier,
      }))
      setCorrections(correctionsWithOriginal)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading driver details")
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailablePoints = async () => {
    try {
      const response = await fetch("/api/points")
      if (!response.ok) return
      
      const data = await response.json()
      if (data.success) {
        setAvailablePoints(
          data.points.map((p: any) => ({ 
            point_id: p.point_id, 
            point_name: p.point_name 
          }))
        )
      }
    } catch (err) {
      console.error("Error loading points:", err)
    }
  }

  const updateCorrection = (index: number, field: keyof CorrectionData, value: any) => {
    setCorrections(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addNewPoint = (tripIdentifier: string) => {
    const tripCorrections = corrections.filter(c => c.trip_identifier === tripIdentifier)
    const maxPointNum = Math.max(...tripCorrections.map(c => c.point_num), 0) + 1

    const newPoint: CorrectionData = {
      phone,
      trip_identifier: tripIdentifier,
      vehicle_number: tripCorrections[0]?.vehicle_number || "",
      planned_loading_time: tripCorrections[0]?.planned_loading_time || new Date().toISOString(),
      point_type: "P",
      point_num: maxPointNum,
      point_id: "",
      driver_comment: tripCorrections[0]?.driver_comment || "",
      message_id: tripCorrections[0]?.message_id || 0,
    }

    setCorrections([...corrections, newPoint])
  }

  const addNewTrip = () => {
    const newTrip: CorrectionData = {
      phone,
      trip_identifier: `NEW-${Date.now()}`,
      vehicle_number: "",
      planned_loading_time: new Date().toISOString(),
      point_type: "P",
      point_num: 1,
      point_id: "",
      driver_comment: "",
      message_id: corrections[0]?.message_id || 0,
    }

    setCorrections([...corrections, newTrip])
  }

  const removePoint = (index: number) => {
    setCorrections(prev => prev.filter((_, i) => i !== index))
  }

  const removeTrip = (tripIdentifier: string) => {
    // Определяем, был ли рейс оригинальным (не новым)
    const isOriginalTrip = corrections.some(
      c => c.trip_identifier === tripIdentifier && c.original_trip_identifier
    )

    // Добавляем в удаленные только оригинальные рейсы
    if (isOriginalTrip) {
      setDeletedTrips(prev => [...prev, tripIdentifier])
    }

    // Удаляем все точки рейса
    setCorrections(prev => prev.filter(c => c.trip_identifier !== tripIdentifier))
  }

  const handleSearchStateChange = useCallback((key: string, state: { open?: boolean; search?: string }) => {
    setPointSearchStates(prev => ({
      ...prev,
      [key]: { 
        ...(prev[key] || { open: false, search: "" }), 
        ...state 
      }
    }))
  }, [])

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""
    try {
      // Прямое извлечение даты и времени из ISO строки
      const [datePart, timePart] = dateString.split("T")
      if (!timePart) return datePart
      
      const [hours, minutes] = timePart.split(":")
      return `${datePart}T${hours}:${minutes}`
    } catch {
      return ""
    }
  }

  const saveCorrections = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/trips/${tripId}/save-corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          corrections: corrections.map(c => ({
            ...c,
            // Корректное сохранение времени
            planned_loading_time: c.planned_loading_time.includes("T")
              ? c.planned_loading_time
              : `${c.planned_loading_time}T00:00:00.000`
          })),
          deletedTrips,
        }),
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to save corrections")
      
      setSuccess("Корректировки успешно сохранены!")
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving corrections")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const sendCorrection = async () => {
    setIsSending(true)
    setError(null)
    setSuccess(null)

    try {
      // Сначала сохраняем корректировки
      const saveSuccess = await saveCorrections()
      if (!saveSuccess) return

      // Затем отправляем водителю
      const response = await fetch(`/api/trips/${tripId}/resend-combined`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          isCorrection: true,
          deletedTrips,
        }),
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to send correction")
      
      setSuccess("Корректировка отправлена водителю!")
      onCorrectionSent()
      setTimeout(onClose, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending correction")
    } finally {
      setIsSending(false)
    }
  }

  // Группировка корректировок по рейсам
  const groupedCorrections = corrections.reduce(
    (groups, correction) => {
      const key = correction.trip_identifier
      if (!groups[key]) groups[key] = []
      groups[key].push(correction)
      return groups
    },
    {} as Record<string, CorrectionData[]>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Корректировка рейсов для {driverName}</DialogTitle>
        </DialogHeader>

        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Внимание:</strong> При отправке корректировки статус подтверждения рейсов будет сброшен.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Загрузка данных...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={addNewTrip} variant="outline" className="text-green-600">
                <Plus className="h-4 w-4 mr-2" />
                Добавить новый рейс
              </Button>
            </div>

            {Object.entries(groupedCorrections).map(([tripIdentifier, tripCorrections]) => (
              <div key={tripIdentifier} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Рейс {tripIdentifier}</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => addNewPoint(tripIdentifier)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить точку
                    </Button>
                    {Object.keys(groupedCorrections).length > 1 && (
                      <Button
                        onClick={() => removeTrip(tripIdentifier)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium">Номер рейса</label>
                    <Input
                      value={tripCorrections[0]?.trip_identifier || ""}
                      onChange={e => {
                        const newIdentifier = e.target.value
                        setCorrections(prev =>
                          prev.map(c =>
                            c.trip_identifier === tripIdentifier
                              ? { ...c, trip_identifier: newIdentifier }
                              : c
                          )
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Транспорт</label>
                    <Input
                      value={tripCorrections[0]?.vehicle_number || ""}
                      onChange={e => {
                        const newVehicle = e.target.value
                        setCorrections(prev =>
                          prev.map(c =>
                            c.trip_identifier === tripIdentifier
                              ? { ...c, vehicle_number: newVehicle }
                              : c
                          )
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Время погрузки</label>
                    <Input
                      type="datetime-local"
                      value={formatDateTime(tripCorrections[0]?.planned_loading_time || "")}
                      onChange={e => {
                        const newTime = e.target.value ? `${e.target.value}:00.000` : ""
                        setCorrections(prev =>
                          prev.map(c =>
                            c.trip_identifier === tripIdentifier
                              ? { ...c, planned_loading_time: newTime }
                              : c
                          )
                        )
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Комментарий</label>
                    <Input
                      value={tripCorrections[0]?.driver_comment || ""}
                      onChange={e => {
                        const newComment = e.target.value
                        setCorrections(prev =>
                          prev.map(c =>
                            c.trip_identifier === tripIdentifier
                              ? { ...c, driver_comment: newComment }
                              : c
                          )
                        )
                      }}
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
                    {tripCorrections.map((correction, index) => {
                      const globalIndex = corrections.findIndex(
                        c => 
                          c.trip_identifier === correction.trip_identifier &&
                          c.point_num === correction.point_num &&
                          c.point_type === correction.point_type
                      )
                      
                      const pointKey = `${correction.trip_identifier}-${correction.point_type}-${correction.point_num}`
                      const searchState = pointSearchStates[pointKey] || { open: false, search: "" }

                      return (
                        <TableRow key={pointKey}>
                          <TableCell>
                            <Select
                              value={correction.point_type}
                              onValueChange={(value: "P" | "D") => updateCorrection(globalIndex, "point_type", value)}
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
                              min={1}
                              value={correction.point_num}
                              onChange={e => updateCorrection(globalIndex, "point_num", Number(e.target.value))}
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <PointSelector
                              value={correction.point_id}
                              onChange={point => {
                                updateCorrection(globalIndex, "point_id", point.point_id)
                                updateCorrection(globalIndex, "point_name", point.point_name)
                              }}
                              pointKey={pointKey}
                              availablePoints={availablePoints}
                              searchState={searchState}
                              onSearchStateChange={handleSearchStateChange}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => removePoint(globalIndex)}
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
            ))}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button 
                onClick={saveCorrections} 
                disabled={isSaving || isSending}
                variant="secondary"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить
                  </>
                )}
              </Button>
              <Button 
                onClick={sendCorrection} 
                disabled={isSending || isSaving}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить корректировку
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
