"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RefreshCw, Send, Plus, Trash2, User, Zap, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  points: Array<{
    point_type: "P" | "D"
    point_num: number
    point_id: string
  }>
}

interface Driver {
  phone: string
  first_name?: string
  full_name?: string
  name: string
  telegram_id: number
  verified: boolean
}

interface QuickTripFormProps {
  isOpen: boolean
  onClose: () => void
  onTripSent: () => void
}

export function QuickTripForm({ isOpen, onClose, onTripSent }: QuickTripFormProps) {
  const [trips, setTrips] = useState<TripData[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>("")
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [availablePoints, setAvailablePoints] = useState<Array<{ point_id: string; point_name: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Загружаем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadDrivers()
      loadAvailablePoints()
      // Создаем один пустой рейс по умолчанию
      setTrips([createEmptyTrip()])
      setSelectedDriver("")
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  const createEmptyTrip = (): TripData => ({
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString().slice(0, 16) + ":00.000",
    driver_comment: "",
    points: [
      {
        point_type: "P",
        point_num: 1,
        point_id: "",
      },
    ],
  })

  const loadDrivers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/users")
      const data = await response.json()

      if (data.success) {
        // Фильтруем только верифицированных водителей
        const verifiedDrivers = data.users.filter((user: Driver) => user.verified && user.telegram_id)
        setDrivers(verifiedDrivers)
      } else {
        setError("Ошибка загрузки списка водителей")
      }
    } catch (error) {
      setError("Ошибка загрузки водителей")
      console.error("Error loading drivers:", error)
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

  const updateTrip = (tripIndex: number, field: keyof TripData, value: any) => {
    const updated = [...trips]
    updated[tripIndex] = { ...updated[tripIndex], [field]: value }
    setTrips(updated)
  }

  const updatePoint = (tripIndex: number, pointIndex: number, field: string, value: any) => {
    const updated = [...trips]
    updated[tripIndex].points[pointIndex] = { ...updated[tripIndex].points[pointIndex], [field]: value }
    setTrips(updated)
  }

  const addNewTrip = () => {
    setTrips([...trips, createEmptyTrip()])
  }

  const removeTrip = (tripIndex: number) => {
    if (trips.length > 1) {
      const updated = trips.filter((_, i) => i !== tripIndex)
      setTrips(updated)
    }
  }

  const addNewPoint = (tripIndex: number) => {
    const updated = [...trips]
    const maxPointNum = Math.max(...updated[tripIndex].points.map((p) => p.point_num || 0), 0)
    updated[tripIndex].points.push({
      point_type: "P",
      point_num: maxPointNum + 1,
      point_id: "",
    })
    setTrips(updated)
  }

  const removePoint = (tripIndex: number, pointIndex: number) => {
    const updated = [...trips]
    if (updated[tripIndex].points.length > 1) {
      updated[tripIndex].points = updated[tripIndex].points.filter((_, i) => i !== pointIndex)
    }
    setTrips(updated)
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""
    try {
      if (dateString.includes("T")) {
        return dateString.slice(0, 16)
      }
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hours = String(date.getHours()).padStart(2, "0")
      const minutes = String(date.getMinutes()).padStart(2, "0")
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return dateString
    }
  }

  const formatDateTimeForSave = (dateString: string) => {
    if (!dateString) return ""
    return dateString + ":00.000"
  }

  const validateForm = () => {
    if (!selectedDriver) {
      setError("Выберите водителя")
      return false
    }

    for (const trip of trips) {
      if (!trip.trip_identifier.trim()) {
        setError("Заполните номер рейса для всех рейсов")
        return false
      }
      if (!trip.vehicle_number.trim()) {
        setError("Заполните номер транспорта для всех рейсов")
        return false
      }
      if (!trip.planned_loading_time) {
        setError("Укажите время погрузки для всех рейсов")
        return false
      }

      for (const point of trip.points) {
        if (!point.point_id) {
          setError("Выберите все точки в рейсах")
          return false
        }
      }
    }

    return true
  }

  const sendQuickTrip = async () => {
    if (!validateForm()) return

    setIsSending(true)
    setError(null)

    try {
      // Подготавливаем данные для отправки
      const tripData = trips.map((trip) => ({
        phone: selectedDriver,
        trip_identifier: trip.trip_identifier,
        vehicle_number: trip.vehicle_number,
        planned_loading_time: trip.planned_loading_time,
        driver_comment: trip.driver_comment,
        loading_points: trip.points
          .filter((p) => p.point_type === "P")
          .map((p) => ({
            point_id: p.point_id,
            point_num: p.point_num,
          })),
        unloading_points: trip.points
          .filter((p) => p.point_type === "D")
          .map((p) => ({
            point_id: p.point_id,
            point_num: p.point_num,
          })),
      }))

      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripData,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`Рассылка отправлена успешно! Отправлено ${data.results?.sent || 0} сообщений.`)
        onTripSent()
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        setError(data.error || "Ошибка при отправке рассылки")
      }
    } catch (error) {
      setError("Ошибка при отправке рассылки")
      console.error("Error sending quick trip:", error)
    } finally {
      setIsSending(false)
    }
  }

  const getDriverDisplayName = (driver: Driver) => {
    return driver.full_name || driver.first_name || driver.name || `ID: ${driver.telegram_id}`
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("380") && phone.length === 12) {
      return `+380 (${phone.slice(3, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
    } else if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`
    }
    return phone
  }

  // Компонент для поиска водителей
  const DriverSelector = () => {
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState("")

    const filteredDrivers = drivers.filter((driver) => {
      const displayName = getDriverDisplayName(driver).toLowerCase()
      const phone = formatPhone(driver.phone).toLowerCase()
      const search = searchValue.toLowerCase()

      return displayName.includes(search) || phone.includes(search) || driver.phone.includes(search)
    })

    const selectedDriverData = drivers.find((driver) => driver.phone === selectedDriver)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedDriverData
              ? `${getDriverDisplayName(selectedDriverData)} - ${formatPhone(selectedDriverData.phone)}`
              : "Выберите водителя для отправки рейса"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder="Поиск по имени или телефону..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>Водители не найдены.</CommandEmpty>
              <CommandGroup>
                {filteredDrivers.map((driver) => (
                  <CommandItem
                    key={driver.phone}
                    value={driver.phone}
                    onSelect={(currentValue) => {
                      setSelectedDriver(currentValue === selectedDriver ? "" : currentValue)
                      setOpen(false)
                      setSearchValue("")
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedDriver === driver.phone ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex items-center justify-between w-full">
                      <span>{getDriverDisplayName(driver)}</span>
                      <span className="text-sm text-gray-500 ml-4">{formatPhone(driver.phone)}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // Компонент для поиска точек
  const PointSelector = ({
    value,
    onValueChange,
    placeholder,
  }: {
    value: string
    onValueChange: (value: string) => void
    placeholder: string
  }) => {
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState("")

    const filteredPoints = availablePoints.filter(
      (point) =>
        point.point_id.toLowerCase().includes(searchValue.toLowerCase()) ||
        point.point_name.toLowerCase().includes(searchValue.toLowerCase()),
    )

    const selectedPoint = availablePoints.find((point) => point.point_id === value)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedPoint ? `${selectedPoint.point_id} - ${selectedPoint.point_name}` : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder="Поиск по ID или названию..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>Точки не найдены.</CommandEmpty>
              <CommandGroup>
                {filteredPoints.map((point) => (
                  <CommandItem
                    key={point.point_id}
                    value={point.point_id}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue === value ? "" : currentValue)
                      setOpen(false)
                      setSearchValue("")
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === point.point_id ? "opacity-100" : "opacity-0")} />
                    {point.point_id} - {point.point_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Быстрая рассылка рейса
          </DialogTitle>
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
            {/* Выбор водителя */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-blue-900">Выбор водителя</h3>
              </div>
              <DriverSelector />
              {drivers.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">Нет доступных верифицированных водителей</p>
              )}
            </div>

            {/* Кнопка добавления рейса */}
            <div className="flex justify-end">
              <Button onClick={addNewTrip} variant="outline" className="text-green-600">
                <Plus className="h-4 w-4 mr-2" />
                Добавить рейс
              </Button>
            </div>

            {/* Рейсы */}
            {trips.map((trip, tripIndex) => (
              <div key={tripIndex} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Рейс #{tripIndex + 1}</h3>
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
                    {trips.length > 1 && (
                      <Button
                        onClick={() => removeTrip(tripIndex)}
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить рейс
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium">Номер рейса *</label>
                    <Input
                      value={trip.trip_identifier}
                      onChange={(e) => updateTrip(tripIndex, "trip_identifier", e.target.value)}
                      placeholder="Введите номер рейса"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Транспорт *</label>
                    <Input
                      value={trip.vehicle_number}
                      onChange={(e) => updateTrip(tripIndex, "vehicle_number", e.target.value)}
                      placeholder="Номер транспорта"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Время погрузки *</label>
                    <Input
                      type="datetime-local"
                      value={formatDateTime(trip.planned_loading_time)}
                      onChange={(e) =>
                        updateTrip(tripIndex, "planned_loading_time", formatDateTimeForSave(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Комментарий</label>
                    <Input
                      value={trip.driver_comment}
                      onChange={(e) => updateTrip(tripIndex, "driver_comment", e.target.value)}
                      placeholder="Комментарий водителю"
                    />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Тип</TableHead>
                      <TableHead>№</TableHead>
                      <TableHead>Точка *</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trip.points.map((point, pointIndex) => (
                      <TableRow key={pointIndex}>
                        <TableCell>
                          <Select
                            value={point.point_type}
                            onValueChange={(value: "P" | "D") =>
                              updatePoint(tripIndex, pointIndex, "point_type", value)
                            }
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
                            onChange={(e) =>
                              updatePoint(tripIndex, pointIndex, "point_num", Number.parseInt(e.target.value))
                            }
                            className="w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <PointSelector
                            value={point.point_id}
                            onValueChange={(value) => updatePoint(tripIndex, pointIndex, "point_id", value)}
                            placeholder="Выберите точку"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => removePoint(tripIndex, pointIndex)}
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            disabled={trip.points.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

            <div className="flex gap-4 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button onClick={sendQuickTrip} disabled={isSending || !selectedDriver}>
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить рассылку
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
