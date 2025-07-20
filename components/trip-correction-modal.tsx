"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Send, Plus, AlertTriangle, User, ChevronsUpDown } from "lucide-react"
import { TripRow } from "./trip-row"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatPhone } from "@/lib/excel"
import { formatDateTime, formatDateTimeForSave } from "@/lib/date" // Importing formatDateTime and formatDateTimeForSave

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

interface Driver {
  phone: string
  name: string
  first_name?: string
  full_name?: string
  telegram_id?: number
  verified?: boolean
}

interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  points?: PointData[]
}

interface DriverTrips {
  driver: Driver
  trips: CorrectionData[]
}

interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: "edit" | "create"
  // Для режима редактирования
  tripId?: number
  phone?: string
  driverName?: string
  // Для режима создания
  initialDriver?: Driver
  initialTrips?: TripData[]
  onCorrectionSent?: (corrections: CorrectionData[], deletedTrips: string[]) => void
  onAssignmentSent?: (results: any) => void
  onOpenConflictTrip: (tripId: number, driverPhone: string, driverName: string) => void
}

export function TripCorrectionModal({
  isOpen,
  onClose,
  mode = "create",
  tripId,
  phone,
  driverName,
  initialDriver,
  initialTrips,
  onCorrectionSent,
  onAssignmentSent,
  onOpenConflictTrip,
}: TripCorrectionModalProps) {
  const [driverTrips, setDriverTrips] = useState<DriverTrips[]>([])
  const [availablePoints, setAvailablePoints] = useState<
    Array<{
      point_id: string
      point_name: string
      latitude?: string
      longitude?: string
    }>
  >([])
  const [pointSearchStates, setPointSearchStates] = useState<Record<string, { open: boolean; search: string }>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [conflictedTrips, setConflictedTrips] = useState<
    Array<{
      trip_identifier: string
      driver_phone: string
      driver_name: string
      trip_id: number
    }>
  >([])
  const [driverSearchOpen, setDriverSearchOpen] = useState(false)
  const [driverSearchValue, setDriverSearchValue] = useState("")
  const [driversList, setDriversList] = useState<Driver[]>([])

  useEffect(() => {
    if (isOpen) {
      setConflictedTrips([])
      setError(null)
      setSuccess(null)

      if (mode === "edit") {
        loadDriverDetails()
      } else {
        loadAvailableDrivers()
        setDriverTrips([
          {
            driver: createEmptyDriver(),
            trips: [createEmptyTrip()],
          },
        ])
      }

      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone, driverName, mode])

  // Вспомогательные функции
  const createEmptyDriver = (): Driver => ({
    phone: "",
    name: "",
    telegram_id: 0,
    verified: true,
  })

  const createEmptyPoint = (): PointData => ({
    point_type: "P",
    point_num: 1,
    point_id: "",
    point_name: "",
    latitude: "",
    longitude: "",
  })

  const createEmptyTrip = (): CorrectionData => ({
    phone: "",
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString(),
    driver_comment: "",
    message_id: 0,
    points: [createEmptyPoint()],
  })

  const loadAvailableDrivers = async () => {
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      if (data.success) {
        setDriversList(data.users.filter((u: Driver) => u.verified))
      }
    } catch (error) {
      console.error("Error loading drivers:", error)
    }
  }

  const loadDriverDetails = async () => {
    if (!phone || !tripId) {
      console.error("Cannot load driver details - phone or tripId missing")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/driver-details?phone=${phone}`)
      const data = await response.json()

      if (data.success) {
        const grouped = data.data.reduce((acc: Record<string, CorrectionData>, item: any) => {
          const key = item.trip_identifier
          if (!acc[key]) {
            acc[key] = {
              phone: item.phone,
              trip_identifier: item.trip_identifier,
              original_trip_identifier: item.trip_identifier,
              vehicle_number: item.vehicle_number,
              planned_loading_time: item.planned_loading_time,
              driver_comment: item.driver_comment,
              message_id: item.message_id,
              points: [],
            }
          }
          acc[key].points.push({
            point_type: item.point_type,
            point_num: item.point_num,
            point_id: item.point_id,
            point_name: item.point_name,
            latitude: item.latitude,
            longitude: item.longitude,
          })
          return acc
        }, {})

        setDriverTrips([
          {
            driver: {
              phone: phone,
              name: driverName || "Неизвестный",
              first_name: driverName,
              full_name: driverName,
            },
            trips: Object.values(grouped),
          },
        ])
      } else {
        setError(data.error || "Не удалось загрузить данные водителя")
      }
    } catch (error) {
      console.error("Error loading driver details:", error)
      setError("Ошибка при загрузке данных водителя")
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailablePoints = async () => {
    try {
      const response = await fetch("/api/points")
      const data = await response.json()

      if (data.success) {
        setAvailablePoints(
          data.points.map((p: any) => ({
            point_id: p.point_id,
            point_name: p.point_name,
            latitude: p.latitude,
            longitude: p.longitude,
          })),
        )
      }
    } catch (error) {
      console.error("Error loading points:", error)
    }
  }

  const updateTrip = (driverIndex: number, tripIndex: number, field: keyof CorrectionData, value: any) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      const trips = [...updated[driverIndex].trips]
      trips[tripIndex] = { ...trips[tripIndex], [field]: value }
      updated[driverIndex].trips = trips
      return updated
    })
  }

  const updatePoint = (
    driverIndex: number,
    tripIndex: number,
    pointIndex: number,
    field: keyof PointData,
    value: any,
  ) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      const trips = [...updated[driverIndex].trips]
      const points = [...trips[tripIndex].points]
      points[pointIndex] = { ...points[pointIndex], [field]: value }
      trips[tripIndex].points = points
      updated[driverIndex].trips = trips
      return updated
    })
  }

  const addNewPoint = (driverIndex: number, tripIndex: number) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      const trips = [...updated[driverIndex].trips]
      trips[tripIndex].points = [...trips[tripIndex].points, createEmptyPoint()]
      updated[driverIndex].trips = trips
      return updated
    })
  }

  const addNewTrip = (driverIndex: number) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      updated[driverIndex].trips = [...updated[driverIndex].trips, createEmptyTrip()]
      return updated
    })
  }

  const addNewDriver = () => {
    setDriverTrips((prev) => [...prev, { driver: createEmptyDriver(), trips: [createEmptyTrip()] }])
  }

  const removePoint = (driverIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      const trips = [...updated[driverIndex].trips]
      trips[tripIndex].points = trips[tripIndex].points.filter((_, i) => i !== pointIndex)
      updated[driverIndex].trips = trips
      return updated
    })
  }

  const removeTrip = (driverIndex: number, tripIndex: number) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      updated[driverIndex].trips.splice(tripIndex, 1)
      return updated
    })
  }

  const removeDriver = (driverIndex: number) => {
    setDriverTrips((prev) => prev.filter((_, i) => i !== driverIndex))
  }

  const saveCorrections = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      // Преобразуем данные в плоский массив для отправки
      const flatCorrections = driverTrips.flatMap((driverTrip) =>
        driverTrip.trips.map((trip) => ({
          ...trip,
          phone: driverTrip.driver.phone,
        })),
      )

      const response = await fetch(`/api/trips/${tripId}/save-corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone,
          corrections: flatCorrections,
          deletedTrips: [],
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("Корректировка сохранена!")
        return true
      } else if (data.error === "trip_already_assigned") {
        setConflictedTrips(data.conflict_data || [])
        setError(`Конфликт рейсов: ${data.trip_identifiers?.join(", ") || "неизвестные рейсы"}`)
        return false
      } else {
        setError(data.error || "Ошибка при сохранении данных")
        return false
      }
    } catch (error) {
      console.error("Error saving corrections:", error)
      setError("Ошибка при сохранении данных")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const sendData = async () => {
    setIsSending(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      const success = await saveCorrections()
      if (success) {
        onClose()
      }
    } catch (error) {
      console.error("Error sending data:", error)
      setError("Ошибка при отправке данных")
    } finally {
      setIsSending(false)
    }
  }

  const getDriverDisplayName = (driver: Driver) => {
    return driver.full_name || driver.first_name || driver.name || `ID: ${driver.telegram_id}`
  }

  const handleSelectDriver = (driver: Driver, driverIndex: number) => {
    setDriverTrips((prev) => {
      const updated = [...prev]
      updated[driverIndex].driver = driver
      updated[driverIndex].trips = updated[driverIndex].trips.map((trip) => ({
        ...trip,
        phone: driver.phone,
      }))
      return updated
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? `Корректировка рейсов для ${driverName}` : "Создание новых рейсов"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {conflictedTrips.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Конфликт рейсов:</strong> Следующие рейсы уже назначены другим водителям:
              <ul className="list-disc pl-5 mt-2">
                {conflictedTrips.map((conflict) => (
                  <li key={conflict.trip_identifier} className="font-mono">
                    {conflict.trip_identifier} (Водитель: {conflict.driver_name})
                  </li>
                ))}
              </ul>
            </AlertDescription>
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
            {driverTrips.map((driverTrip, driverIndex) => (
              <div key={`driver-${driverIndex}`} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Водитель {driverIndex + 1}</h3>
                  {mode === "create" && (
                    <Button
                      onClick={() => removeDriver(driverIndex)}
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                    >
                      Удалить водителя
                    </Button>
                  )}
                </div>

                {mode === "create" && (
                  <div className="border rounded-lg p-4 bg-blue-50 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-blue-900">Выбор водителя</h3>
                    </div>

                    <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={driverSearchOpen}
                          className="w-full justify-between bg-transparent"
                        >
                          {driverTrip.driver.phone
                            ? `${getDriverDisplayName(driverTrip.driver)} (${formatPhone(driverTrip.driver.phone)})`
                            : "Выберите водителя"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Поиск по имени или телефону..."
                            value={driverSearchValue}
                            onValueChange={setDriverSearchValue}
                          />
                          <CommandList>
                            <CommandEmpty>Водители не найдены</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-auto">
                              {driversList.map((driver) => (
                                <CommandItem
                                  key={driver.phone}
                                  value={`${getDriverDisplayName(driver)} ${driver.phone}`}
                                  onSelect={() => {
                                    handleSelectDriver(driver, driverIndex)
                                    setDriverSearchOpen(false)
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span>{getDriverDisplayName(driver)}</span>
                                    <span className="text-sm text-gray-500">{formatPhone(driver.phone)}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => addNewTrip(driverIndex)}
                    variant="outline"
                    className="text-green-600 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить новый рейс
                  </Button>
                </div>

                {driverTrip.trips.map((trip, tripIndex) => (
                  <TripRow
                    key={trip.original_trip_identifier || `trip-${tripIndex}`}
                    trip={trip}
                    tripIndex={tripIndex}
                    availablePoints={availablePoints}
                    pointSearchStates={{}}
                    handleSearchStateChange={() => {}}
                    updateTrip={(tripIndex, field, value) => updateTrip(driverIndex, tripIndex, field, value)}
                    movePointUp={() => {}}
                    movePointDown={() => {}}
                    updatePoint={(tripIndex, pointIndex, field, value) =>
                      updatePoint(driverIndex, tripIndex, pointIndex, field, value)
                    }
                    addNewPoint={() => addNewPoint(driverIndex, tripIndex)}
                    removePoint={(pointIndex) => removePoint(driverIndex, tripIndex, pointIndex)}
                    removeTrip={() => removeTrip(driverIndex, tripIndex)}
                    correctionsLength={driverTrip.trips.length}
                    formatDateTime={formatDateTime}
                    formatDateTimeForSave={formatDateTimeForSave}
                  />
                ))}
              </div>
            ))}

            {mode === "create" && (
              <div className="flex justify-end">
                <Button onClick={addNewDriver} variant="outline" className="text-green-600 bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить водителя
                </Button>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button onClick={sendData} disabled={isSending || isSaving}>
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {mode === "edit" ? "Отправка..." : "Создание..."}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {mode === "edit" ? "Отправить корректировку" : "Создать рейсы"}
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
