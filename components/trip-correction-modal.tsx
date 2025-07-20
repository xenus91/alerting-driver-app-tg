"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Send, Plus, AlertTriangle, User, ChevronsUpDown, X } from "lucide-react"
import { TripRow } from "./trip-row"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { v4 as uuidv4 } from "uuid" // Для генерации уникальных ID групп

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

// Новая структура для групп водитель-рейсы
interface DriverTripGroup {
  id: string // Уникальный ID для ключей React
  driver: Driver | null
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
  // Для режима создания (теперь может быть несколько групп)
  initialDriver?: Driver
  initialTrips?: TripData[]
  onCorrectionSent?: (corrections: CorrectionData[], deletedTrips: string[]) => void
  onAssignmentSent?: (results: any) => void
  onOpenConflictTrip: (tripId: number, driverPhone: string, driverName: string) => void
}

export function TripCorrectionModal({
  isOpen,
  onClose,
  mode = "edit",
  tripId,
  phone,
  driverName,
  initialDriver,
  initialTrips,
  onCorrectionSent,
  onAssignmentSent,
  onOpenConflictTrip,
}: TripCorrectionModalProps) {
  const [driverTripGroups, setDriverTripGroups] = useState<DriverTripGroup[]>([]) // Изменено на массив групп
  const [deletedTrips, setDeletedTrips] = useState<string[]>([])
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
  const [driversList, setDriversList] = useState<Driver[]>([])

  useEffect(() => {
    console.log("TripCorrectionModal useEffect:", {
      isOpen,
      mode,
      tripId,
      phone,
      driverName,
    })

    if (isOpen) {
      setConflictedTrips([])
      setError(null)
      setSuccess(null)
      setDeletedTrips([]) // Сбрасываем удаленные рейсы при открытии

      if (mode === "edit") {
        console.log("Loading driver details for edit mode", {
          tripId,
          phone,
        })

        if (!phone || !tripId) {
          console.error("Phone or tripId missing for edit mode")
          onClose() // Закрываем модалку, если данные неполные
          return
        }

        // В режиме редактирования всегда одна группа
        setDriverTripGroups([
          {
            id: uuidv4(),
            driver: {
              phone: phone,
              name: driverName || "Неизвестный",
              first_name: driverName,
              full_name: driverName,
            },
            trips: [], // Будет заполнено loadDriverDetails
          },
        ])
        loadDriverDetails(phone, tripId)
      } else {
        console.log("Initializing create mode")
        if (initialDriver && initialTrips && initialTrips.length > 0) {
          console.log("Using initial driver and trips:", initialDriver, initialTrips)
          setDriverTripGroups([
            {
              id: uuidv4(),
              driver: initialDriver,
              trips: initialTrips.map((trip) => ({
                phone: initialDriver.phone || "",
                trip_identifier: trip.trip_identifier,
                original_trip_identifier: trip.trip_identifier,
                vehicle_number: trip.vehicle_number,
                planned_loading_time: trip.planned_loading_time,
                driver_comment: trip.driver_comment || "",
                message_id: 0,
                points: trip.points || [createEmptyPoint()],
              })),
            },
          ])
        } else {
          console.log("Creating empty driver group")
          setDriverTripGroups([createEmptyDriverGroup()])
        }
      }

      loadAvailablePoints()
      if (mode === "create") {
        loadDriversList()
      }
    }
  }, [isOpen, tripId, phone, driverName, mode, initialDriver, initialTrips])

  // Вспомогательные функции
  const createEmptyPoint = (): PointData => ({
    point_type: "P",
    point_num: 1,
    point_id: "",
    point_name: "",
    latitude: "",
    longitude: "",
  })

  const createEmptyTrip = (driverPhone = ""): CorrectionData => ({
    phone: driverPhone,
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM
    driver_comment: "",
    message_id: 0,
    points: [createEmptyPoint()],
  })

  const createEmptyDriver = (): Driver => ({
    phone: "",
    name: "",
    telegram_id: 0,
    verified: true,
  })

  const createEmptyDriverGroup = (): DriverTripGroup => ({
    id: uuidv4(),
    driver: null, // Изначально водитель не выбран
    trips: [createEmptyTrip()],
  })

  // Функции перемещения точек - правильная логика
  const movePointUp = useCallback((groupIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      const points = [...updatedGroups[groupIndex].trips[tripIndex].points]

      const currentPoint = points[pointIndex]
      const targetPointNum = currentPoint.point_num - 1
      const targetPointIndex = points.findIndex((p) => p.point_num === targetPointNum)

      if (targetPointIndex === -1) return prevGroups

      const targetPoint = points[targetPointIndex]

      const newCurrentPointNum = targetPoint.point_num
      const newTargetPointNum = currentPoint.point_num

      points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
      points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

      updatedGroups[groupIndex].trips[tripIndex].points = points
      return updatedGroups
    })
  }, [])

  const movePointDown = useCallback((groupIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      const points = [...updatedGroups[groupIndex].trips[tripIndex].points]

      const currentPoint = points[pointIndex]
      const targetPointNum = currentPoint.point_num + 1
      const targetPointIndex = points.findIndex((p) => p.point_num === targetPointNum)

      if (targetPointIndex === -1) return prevGroups

      const targetPoint = points[targetPointIndex]

      const newCurrentPointNum = targetPoint.point_num
      const newTargetPointNum = currentPoint.point_num

      points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
      points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

      updatedGroups[groupIndex].trips[tripIndex].points = points
      return updatedGroups
    })
  }, [])

  // Обновленная функция удаления точки с пересчетом
  const removePoint = useCallback((groupIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      const points = [...updatedGroups[groupIndex].trips[tripIndex].points]

      const filteredPoints = points.filter((_, i) => i !== pointIndex)

      const recalculatedPoints = filteredPoints.map((point, index) => ({
        ...point,
        point_num: index + 1,
      }))

      updatedGroups[groupIndex].trips[tripIndex].points = recalculatedPoints
      return updatedGroups
    })
  }, [])

  const loadDriverDetails = async (targetPhone: string, targetTripId: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${targetTripId}/driver-details?phone=${targetPhone}`)
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

        setDriverTripGroups((prevGroups) => {
          // В режиме редактирования всегда одна группа, обновляем ее
          const updatedGroups = [...prevGroups]
          if (updatedGroups.length > 0) {
            updatedGroups[0].trips = Object.values(grouped)
          }
          return updatedGroups
        })
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

  const loadDriversList = async () => {
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

  // Работа с рейсами и точками
  const updateTrip = useCallback((groupIndex: number, tripIndex: number, field: keyof CorrectionData, value: any) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      updatedGroups[groupIndex].trips[tripIndex] = { ...updatedGroups[groupIndex].trips[tripIndex], [field]: value }
      return updatedGroups
    })
  }, [])

  const updatePoint = useCallback(
    (groupIndex: number, tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => {
      setDriverTripGroups((prevGroups) => {
        const updatedGroups = [...prevGroups]
        updatedGroups[groupIndex].trips[tripIndex].points[pointIndex] = {
          ...updatedGroups[groupIndex].trips[tripIndex].points[pointIndex],
          [field]: value,
        }
        return updatedGroups
      })
    },
    [],
  )

  const addNewPoint = (groupIndex: number, tripIndex: number) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      const currentPoints = updatedGroups[groupIndex].trips[tripIndex].points
      const maxPointNum = currentPoints.length > 0 ? Math.max(...currentPoints.map((p) => p.point_num || 0)) : 0

      const newPoint: PointData = {
        point_type: "P",
        point_num: maxPointNum + 1,
        point_id: "",
        point_name: "",
        latitude: "",
        longitude: "",
      }

      updatedGroups[groupIndex].trips[tripIndex].points = [...currentPoints, newPoint]
      return updatedGroups
    })
  }

  const addNewTrip = (groupIndex: number) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      const driverPhone = updatedGroups[groupIndex].driver?.phone || ""
      updatedGroups[groupIndex].trips = [...updatedGroups[groupIndex].trips, createEmptyTrip(driverPhone)]
      return updatedGroups
    })
  }

  const removeTrip = (groupIndex: number, tripIndex: number) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      const tripIdentifier =
        updatedGroups[groupIndex].trips[tripIndex].original_trip_identifier ||
        updatedGroups[groupIndex].trips[tripIndex].trip_identifier

      updatedGroups[groupIndex].trips = updatedGroups[groupIndex].trips.filter((_, i) => i !== tripIndex)

      if (tripIdentifier && mode === "edit") {
        setDeletedTrips((prev) => [...prev, tripIdentifier])
      }
      return updatedGroups
    })
  }

  const addNewDriverGroup = () => {
    setDriverTripGroups((prevGroups) => [...prevGroups, createEmptyDriverGroup()])
  }

  const removeDriverGroup = (groupIndex: number) => {
    setDriverTripGroups((prevGroups) => prevGroups.filter((_, i) => i !== groupIndex))
  }

  const setDriverForGroup = useCallback((groupIndex: number, selectedDriver: Driver) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = [...prevGroups]
      updatedGroups[groupIndex].driver = selectedDriver
      // Обновляем phone во всех рейсах этой группы
      updatedGroups[groupIndex].trips = updatedGroups[groupIndex].trips.map((trip) => ({
        ...trip,
        phone: selectedDriver.phone,
      }))
      return updatedGroups
    })
  }, [])

  // Сохранение и отправка
  const saveCorrections = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      const allFlatCorrections = driverTripGroups.flatMap((group) =>
        group.trips.flatMap((trip) =>
          trip.points.map((point) => ({
            phone: group.driver?.phone || "", // Берем телефон из группы
            driver_phone: group.driver?.phone || "",
            trip_identifier: trip.trip_identifier,
            original_trip_identifier: trip.original_trip_identifier,
            vehicle_number: trip.vehicle_number,
            planned_loading_time: formatDateTimeForSave(trip.planned_loading_time),
            driver_comment: trip.driver_comment,
            message_id: trip.message_id,
            point_type: point.point_type,
            point_num: point.point_num,
            point_id: point.point_id,
            point_name: point.point_name,
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        ),
      )

      const endpoint = mode === "edit" ? `/api/trips/${tripId}/save-corrections` : "/api/send-messages"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "edit"
            ? {
                phone: phone, // В режиме edit используем phone из пропсов
                driver_phone: phone,
                corrections: allFlatCorrections,
                deletedTrips,
              }
            : {
                tripData: driverTripGroups.map((group) => ({
                  phone: group.driver?.phone || "",
                  trips: group.trips.map((trip) => ({
                    trip_identifier: trip.trip_identifier,
                    vehicle_number: trip.vehicle_number,
                    planned_loading_time: formatDateTimeForSave(trip.planned_loading_time),
                    driver_comment: trip.driver_comment,
                    loading_points: trip.points
                      .filter((p) => p.point_type === "P")
                      .map((p) => ({
                        point_id: p.point_id,
                        point_num: p.point_num,
                        driver_phone: group.driver?.phone || "",
                      })),
                    unloading_points: trip.points
                      .filter((p) => p.point_type === "D")
                      .map((p) => ({
                        point_id: p.point_id,
                        point_num: p.point_num,
                        driver_phone: group.driver?.phone || "",
                      })),
                  })),
                })),
              },
        ),
      })

      const data = await response.json()

      if (data.success) {
        return { success: true, data }
      } else if (data.error === "trip_already_assigned") {
        setConflictedTrips(data.conflict_data || [])
        setError(`Конфликт рейсов: ${data.trip_identifiers?.join(", ") || "неизвестные рейсы"}`)
        return { success: false, conflict: true }
      } else {
        setError(data.error || "Ошибка при сохранении данных")
        return { success: false }
      }
    } catch (error) {
      console.error("❌ Save error:", error)
      setError("Ошибка при сохранении данных")
      return { success: false }
    } finally {
      setIsSaving(false)
    }
  }

  const sendData = async () => {
    setIsSending(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    // Проверка, что для всех групп выбран водитель и есть хотя бы один рейс
    const isValid = driverTripGroups.every(
      (group) =>
        group.driver?.phone &&
        group.trips.length > 0 &&
        group.trips.every((trip) => trip.trip_identifier && trip.vehicle_number && trip.planned_loading_time),
    )

    if (!isValid) {
      setError("Пожалуйста, выберите водителя и заполните все обязательные поля для каждого рейса.")
      setIsSending(false)
      return
    }

    try {
      const { success, data, conflict } = await saveCorrections()

      if (!success) {
        if (conflict) return
        throw new Error("Не удалось сохранить данные")
      }

      if (mode === "edit") {
        // В режиме редактирования, message_id берется из первой группы, так как это один водитель
        const messageIds = [...new Set(driverTripGroups[0].trips.map((c) => c.message_id))]
        const resendResponse = await fetch(`/api/trips/messages/${messageIds[0]}/resend-combined`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone, // Используем phone из пропсов для edit mode
            driver_phone: phone,
            messageIds,
            isCorrection: true,
            deletedTrips,
          }),
        })

        const resendData = await resendResponse.json()
        if (resendData.success) {
          setSuccess("Корректировка отправлена водителю!")
          if (onCorrectionSent) {
            onCorrectionSent(driverTripGroups[0].trips, deletedTrips) // Передаем рейсы первой группы
          }
        } else {
          setError(resendData.error || "Ошибка при отправке корректировки")
        }
      } else {
        setSuccess("Рассылка создана успешно!")
        if (onAssignmentSent) {
          onAssignmentSent(data)
        }
      }

      if (success) {
        setTimeout(() => onClose(), 3000)
      }
    } catch (error) {
      console.error("❌ Send error:", error)
      setError("Ошибка при отправке данных")
    } finally {
      setIsSending(false)
    }
  }

  const openConflictTripModal = (conflict: {
    trip_id: number
    driver_phone: string
    driver_name: string
    trip_identifier: string
  }) => {
    onClose()
    setTimeout(() => {
      onOpenConflictTrip(conflict.trip_id, conflict.driver_phone, conflict.driver_name)
    }, 100)
  }

  // Форматирование данных
  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""

    try {
      // Если уже в формате YYYY-MM-DDTHH:MM, просто возвращаем
      if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        return dateString
      }

      // Если это полный ISO-строка, обрезаем до YYYY-MM-DDTHH:MM
      if (dateString.includes("T") && dateString.includes(":")) {
        return dateString.slice(0, 16)
      }

      // Попытка парсинга для других форматов
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date string")
      }
      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const day = date.getDate().toString().padStart(2, "0")
      const hours = date.getHours().toString().padStart(2, "0")
      const minutes = date.getMinutes().toString().padStart(2, "0")
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch (error) {
      console.error("Error formatting date:", error, "Input:", dateString)
      return ""
    }
  }

  const formatDateTimeForSave = (dateString: string) => {
    if (!dateString) return ""
    try {
      // Добавляем секунды и миллисекунды для корректного формата ISO
      return dateString + ":00.000Z" // Добавляем Z для UTC, если это не локальное время
    } catch {
      return dateString
    }
  }

  const handleSearchStateChange = useCallback((key: string, state: { open?: boolean; search?: string }) => {
    setPointSearchStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...state },
    }))
  }, [])

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? `Корректировка рейсов для ${driverName}` : "Создание новых рейсов"}
          </DialogTitle>
        </DialogHeader>

        {mode === "edit" && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Внимание:</strong> При отправке корректировки статус подтверждения рейсов будет сброшен.
            </AlertDescription>
          </Alert>
        )}

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
                  <li key={conflict.trip_identifier} className="font-mono flex items-center justify-between">
                    <span>
                      {conflict.trip_identifier} (Водитель: {conflict.driver_name})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 bg-transparent"
                      onClick={() => openConflictTripModal(conflict)}
                    >
                      Просмотреть рейс
                    </Button>
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
            {mode === "create" && (
              <div className="flex justify-end">
                <Button onClick={addNewDriverGroup} variant="outline" className="text-blue-600 bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить нового водителя
                </Button>
              </div>
            )}

            {driverTripGroups.map((group, groupIndex) => (
              <div key={group.id} className="border rounded-lg p-4 bg-gray-50 relative">
                {mode === "create" && driverTripGroups.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                    onClick={() => removeDriverGroup(groupIndex)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {mode === "create" && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-blue-900">Выбор водителя для группы {groupIndex + 1}</h3>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={false} // Managed internally by Popover
                          className="w-full justify-between bg-white"
                        >
                          {group.driver?.phone
                            ? `${getDriverDisplayName(group.driver)} (${formatPhone(group.driver.phone)})`
                            : "Выберите водителя"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Поиск по имени или телефону..."
                            value={
                              driversList.find((d) => d.phone === group.driver?.phone)?.full_name ||
                              group.driver?.phone ||
                              ""
                            }
                            onValueChange={(search) => {
                              // This is a bit tricky with shadcn's CommandInput.
                              // It's usually for filtering, not direct value setting.
                              // For simplicity, we'll just filter the list.
                              // The actual selection happens on CommandItem click.
                            }}
                          />
                          <CommandList>
                            <CommandEmpty>Водители не найдены</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-auto">
                              {driversList
                                .filter((driver) => {
                                  const search = (
                                    driversList.find((d) => d.phone === group.driver?.phone)?.full_name ||
                                    group.driver?.phone ||
                                    ""
                                  ).toLowerCase()
                                  return (
                                    driver.phone.toLowerCase().includes(search) ||
                                    (driver.full_name || "").toLowerCase().includes(search) ||
                                    (driver.first_name || "").toLowerCase().includes(search)
                                  )
                                })
                                .map((driver) => (
                                  <CommandItem
                                    key={driver.phone}
                                    value={`${getDriverDisplayName(driver)} ${driver.phone}`}
                                    onSelect={() => {
                                      setDriverForGroup(groupIndex, driver)
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
                    <Separator className="my-4" />
                  </>
                )}

                <div className="flex justify-end mb-4">
                  <Button
                    onClick={() => addNewTrip(groupIndex)}
                    variant="outline"
                    className="text-green-600 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить рейс для этого водителя
                  </Button>
                </div>

                {group.trips.map((trip, tripIndex) => (
                  <TripRow
                    key={`${group.id}-${trip.original_trip_identifier || `trip-${tripIndex}`}`}
                    trip={trip}
                    tripIndex={tripIndex}
                    availablePoints={availablePoints}
                    pointSearchStates={pointSearchStates}
                    handleSearchStateChange={handleSearchStateChange}
                    updateTrip={(field, value) => updateTrip(groupIndex, tripIndex, field, value)}
                    movePointUp={(pointIdx) => movePointUp(groupIndex, tripIndex, pointIdx)}
                    movePointDown={(pointIdx) => movePointDown(groupIndex, tripIndex, pointIdx)}
                    updatePoint={(pointIdx, field, value) => updatePoint(groupIndex, tripIndex, pointIdx, field, value)}
                    addNewPoint={() => addNewPoint(groupIndex, tripIndex)}
                    removePoint={(pointIdx) => removePoint(groupIndex, tripIndex, pointIdx)}
                    removeTrip={() => removeTrip(groupIndex, tripIndex)}
                    correctionsLength={group.trips.length} // Передаем длину рейсов в текущей группе
                    formatDateTime={formatDateTime}
                    formatDateTimeForSave={formatDateTimeForSave}
                  />
                ))}
              </div>
            ))}

            <div className="flex gap-4 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button
                onClick={sendData}
                disabled={
                  isSending ||
                  isSaving ||
                  conflictedTrips.length > 0 ||
                  driverTripGroups.some(
                    (group) =>
                      !group.driver?.phone ||
                      group.trips.length === 0 ||
                      group.trips.some(
                        (trip) => !trip.trip_identifier || !trip.vehicle_number || !trip.planned_loading_time,
                      ),
                  )
                }
                title={
                  conflictedTrips.length > 0
                    ? "Сначала разрешите конфликты рейсов"
                    : driverTripGroups.some((group) => !group.driver?.phone)
                      ? "Выберите водителя для всех групп"
                      : driverTripGroups.some((group) => group.trips.length === 0)
                        ? "Добавьте хотя бы один рейс для каждой группы"
                        : ""
                }
              >
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
