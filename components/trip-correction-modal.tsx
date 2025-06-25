"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Save, Send, Plus, Trash2 } from "lucide-react"

interface CorrectionData {
  phone: string
  trip_identifier: string
  original_trip_identifier?: string // Добавляем для отслеживания изменений
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

export function TripCorrectionModal({
  isOpen,
  onClose,
  tripId,
  phone,
  driverName,
  onCorrectionSent,
}: TripCorrectionModalProps) {
  const [corrections, setCorrections] = useState<CorrectionData[]>([])
  const [availablePoints, setAvailablePoints] = useState<Array<{ point_id: string; point_name: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Загружаем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadDriverDetails()
      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone])

  const loadDriverDetails = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/driver-details?phone=${phone}`)
      const data = await response.json()

      if (data.success) {
        // Добавляем original_trip_identifier для отслеживания изменений
        const correctionsWithOriginal = data.data.map((item: CorrectionData) => ({
          ...item,
          original_trip_identifier: item.trip_identifier,
        }))
        setCorrections(correctionsWithOriginal)
      } else {
        setError(data.error || "Failed to load driver details")
      }
    } catch (error) {
      setError("Error loading driver details")
      console.error("Error loading driver details:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailablePoints = async () => {
    try {
      const response = await fetch("/api/points")
      const data = await response.json()

      if (data.success) {
        setAvailablePoints(data.points.map((p: any) => ({ point_id: p.point_id, point_name: p.point_name })))
      }
    } catch (error) {
      console.error("Error loading points:", error)
    }
  }

  const updateCorrection = (index: number, field: keyof CorrectionData, value: any) => {
    const updated = [...corrections]
    updated[index] = { ...updated[index], [field]: value }
    setCorrections(updated)
  }

  const addNewPoint = (tripIdentifier: string) => {
    const tripCorrections = corrections.filter((c) => c.trip_identifier === tripIdentifier)
    const maxPointNum = Math.max(...tripCorrections.map((c) => c.point_num || 0), 0)

    const newPoint: CorrectionData = {
      phone,
      trip_identifier: tripIdentifier,
      vehicle_number: tripCorrections[0]?.vehicle_number || "",
      planned_loading_time: tripCorrections[0]?.planned_loading_time || "",
      point_type: "P",
      point_num: maxPointNum + 1,
      point_id: "",
      driver_comment: tripCorrections[0]?.driver_comment || "",
      message_id: tripCorrections[0]?.message_id || 0,
    }

    setCorrections([...corrections, newPoint])
  }

  const removePoint = (index: number) => {
    const updated = corrections.filter((_, i) => i !== index)
    setCorrections(updated)
  }

  const saveCorrections = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/trips/${tripId}/save-corrections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          corrections,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("Корректировки сохранены успешно!")
      } else {
        setError(data.error || "Failed to save corrections")
      }
    } catch (error) {
      setError("Error saving corrections")
      console.error("Error saving corrections:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const sendCorrection = async () => {
    setIsSending(true)
    setError(null)

    try {
      // Сначала сохраняем корректировки
      await saveCorrections()

      // Затем отправляем корректировку водителю
      const messageIds = [...new Set(corrections.map((c) => c.message_id))]

      const response = await fetch(`/api/trips/messages/${messageIds[0]}/resend-combined`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          messageIds,
          isCorrection: true, // Флаг для обозначения корректировки
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("Корректировка отправлена водителю!")
        onCorrectionSent()
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError(data.error || "Failed to send correction")
      }
    } catch (error) {
      setError("Error sending correction")
      console.error("Error sending correction:", error)
    } finally {
      setIsSending(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""
    try {
      // Преобразуем в формат для input datetime-local
      const date = new Date(dateString)
      return date.toISOString().slice(0, 16)
    } catch {
      return dateString
    }
  }

  const formatDateTimeForSave = (dateString: string) => {
    if (!dateString) return ""
    try {
      return new Date(dateString).toISOString()
    } catch {
      return dateString
    }
  }

  // Группируем корректировки по trip_identifier
  const groupedCorrections = corrections.reduce(
    (groups, correction) => {
      const key = correction.trip_identifier
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(correction)
      return groups
    },
    {} as Record<string, CorrectionData[]>,
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Корректировка рейсов для {driverName}</DialogTitle>
        </DialogHeader>

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
            {Object.entries(groupedCorrections).map(([tripIdentifier, tripCorrections]) => (
              <div key={tripIdentifier} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Рейс {tripIdentifier}</h3>
                  <Button
                    onClick={() => addNewPoint(tripIdentifier)}
                    variant="outline"
                    size="sm"
                    className="text-blue-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить точку
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium">Номер рейса</label>
                    <Input
                      value={tripCorrections[0]?.trip_identifier || ""}
                      onChange={(e) => {
                        // Обновляем для всех точек этого рейса
                        const updatedCorrections = corrections.map((c) =>
                          c.original_trip_identifier === tripIdentifier || c.trip_identifier === tripIdentifier
                            ? { ...c, trip_identifier: e.target.value }
                            : c,
                        )
                        setCorrections(updatedCorrections)
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Транспорт</label>
                    <Input
                      value={tripCorrections[0]?.vehicle_number || ""}
                      onChange={(e) => {
                        // Обновляем для всех точек этого рейса
                        const updatedCorrections = corrections.map((c) =>
                          c.original_trip_identifier === tripIdentifier || c.trip_identifier === tripIdentifier
                            ? { ...c, vehicle_number: e.target.value }
                            : c,
                        )
                        setCorrections(updatedCorrections)
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Время погрузки</label>
                    <Input
                      type="datetime-local"
                      value={formatDateTime(tripCorrections[0]?.planned_loading_time || "")}
                      onChange={(e) => {
                        const isoDate = formatDateTimeForSave(e.target.value)
                        const updatedCorrections = corrections.map((c) =>
                          c.original_trip_identifier === tripIdentifier || c.trip_identifier === tripIdentifier
                            ? { ...c, planned_loading_time: isoDate }
                            : c,
                        )
                        setCorrections(updatedCorrections)
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Комментарий</label>
                    <Input
                      value={tripCorrections[0]?.driver_comment || ""}
                      onChange={(e) => {
                        const updatedCorrections = corrections.map((c) =>
                          c.original_trip_identifier === tripIdentifier || c.trip_identifier === tripIdentifier
                            ? { ...c, driver_comment: e.target.value }
                            : c,
                        )
                        setCorrections(updatedCorrections)
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
                        (c) =>
                          c.trip_identifier === correction.trip_identifier &&
                          c.point_num === correction.point_num &&
                          c.point_type === correction.point_type,
                      )
                      return (
                        <TableRow
                          key={`${correction.trip_identifier}-${correction.point_type}-${correction.point_num}`}
                        >
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
                              value={correction.point_num}
                              onChange={(e) =>
                                updateCorrection(globalIndex, "point_num", Number.parseInt(e.target.value))
                              }
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={correction.point_id}
                              onValueChange={(value) => updateCorrection(globalIndex, "point_id", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите точку" />
                              </SelectTrigger>
                              <SelectContent>
                                {availablePoints.map((point) => (
                                  <SelectItem key={point.point_id} value={point.point_id}>
                                    {point.point_id} - {point.point_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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

            <div className="flex gap-4 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button onClick={saveCorrections} disabled={isSaving} variant="secondary">
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
              <Button onClick={sendCorrection} disabled={isSending || isSaving}>
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
