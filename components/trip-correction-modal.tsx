"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Send, Plus, AlertTriangle, User, ChevronsUpDown } from "lucide-react"
import { TripRow } from "./trip-row"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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

// === НОВЫЙ ИНТЕРФЕЙС ===
// Интерфейс для хранения данных водителя и его рейсов
interface DriverAssignment {
  driver: Driver | null
  corrections: CorrectionData[]
}


interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  points?: PointData[]
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
  // === ИЗМЕНЕНО: Используем массив driverAssignments вместо driver и corrections ===
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([])
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
 // === НОВОЕ: Состояния для каждого водителя ===
  const [driverSearchStates, setDriverSearchStates] = useState<Record<string, { open: boolean; search: string }>>({})

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

      if (mode === "edit") {
        console.log("Loading driver details for edit mode", {
          tripId,
          phone,
        })

        if (!phone || !tripId) {
          console.error("Phone or tripId missing for edit mode")
          return
        }

        // === ИЗМЕНЕНО: Инициализация для режима edit ===
        setDriverAssignments([{
          driver: {
            phone: phone,
            name: driverName || "Неизвестный",
            first_name: driverName,
            full_name: driverName,
          },
          corrections: []
        }])
        loadDriverDetails()
      } else {
        console.log("Initializing create mode")

        // === ИЗМЕНЕНО: Инициализация для режима create ===
        if (initialDriver && initialTrips && initialTrips.length > 0) {
          console.log("Using initial driver and trips:", initialDriver, initialTrips)
          setDriverAssignments([{
            driver: initialDriver,
            corrections: initialTrips.map((trip) => ({
              phone: initialDriver.phone || "",
              trip_identifier: trip.trip_identifier,
              original_trip_identifier: trip.trip_identifier,
              vehicle_number: trip.vehicle_number,
              planned_loading_time: trip.planned_loading_time,
              driver_comment: trip.driver_comment || "",
              message_id: 0,
              points: trip.points || [createEmptyPoint()],
            }))
          }])
        } else {
          console.log("Creating empty driver assignment")
          setDriverAssignments([{
            driver: null,
            corrections: [createEmptyTrip()]
          }])
        }
      }

      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone, driverName, mode, initialDriver, initialTrips])

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

 // === ИСПРАВЛЕНО: Удалена ссылка на driver, добавлен параметр phone ===
  const createEmptyTrip = (phone: string = ""): CorrectionData => ({
    phone,
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString(),
    driver_comment: "",
    message_id: 0,
    points: [createEmptyPoint()],
  })

  // === НОВАЯ ФУНКЦИЯ: Добавление нового водителя ===
  const addNewDriver = () => {
    console.log("➕ addNewDriver called")
    setDriverAssignments([...driverAssignments, {
      driver: null,
      corrections: [createEmptyTrip()]
    }])
  }

  // === НОВАЯ ФУНКЦИЯ: Удаление водителя ===
  const removeDriver = (driverIndex: number) => {
    console.log(`🗑️ removeDriver called: driverIndex=${driverIndex}`)
    setDriverAssignments((prev) => prev.filter((_, i) => i !== driverIndex))
    // Добавляем trip_identifier удаленных рейсов в deletedTrips
    const deletedTripIdentifiers = driverAssignments[driverIndex].corrections
      .map(trip => trip.original_trip_identifier || trip.trip_identifier)
      .filter(id => id);
    setDeletedTrips((prev) => [...prev, ...deletedTripIdentifiers]);
  }

  // Функции перемещения точек
  const movePointUp = useCallback((driverIndex: number, tripIndex: number, pointIndex: number) => {
    console.log(`🔼 movePointUp called: driverIndex=${driverIndex}, tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setDriverAssignments((prev) => {
      const updated = [...prev]
      const points = [...updated[driverIndex].corrections[tripIndex].Touch]

      console.log(
        "Points before movePointUp:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      const currentPoint = points[pointIndex]
      console.log(
        `Current point: ${currentPoint.point_id} (${currentPoint.point_type}) with point_num=${currentPoint.point_num}`,
      )

      const targetPointNum = currentPoint.point_num - 1
      const targetPointIndex = points.findIndex((p) => p.point_num === targetPointNum)

      console.log(`Looking for point with point_num=${targetPointNum}, found at index=${targetPointIndex}`)

      if (targetPointIndex === -1) {
        console.log("❌ Cannot move up - no point with smaller point_num found")
        return prev
      }

      const targetPoint = points[targetPointIndex]
      console.log(
        `Target point: ${targetPoint.point_id} (${targetPoint.point_type}) with point_num=${targetPoint.point_num}`,
      )

      points[pointIndex] = { ...currentPoint, point_num: targetPoint.point_num }
      points[targetPointIndex] = { ...targetPoint, point_num: currentPoint.point_num }

      console.log(
        "Points after movePointUp:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      updated[driverIndex].corrections[tripIndex].points = points
      return updated
    })
  }, [])

  const movePointDown = useCallback((driverIndex: number, tripIndex: number, pointIndex: number) => {
    console.log(`🔽 movePointDown called: driverIndex=${driverIndex}, tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setDriverAssignments((prev) => {
      const updated = [...prev]
      const points = [...updated[driverIndex].corrections[tripIndex].points]

      console.log(
        "Points before movePointDown:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      const currentPoint = points[pointIndex]
      console.log(
        `Current point: ${currentPoint.point_id} (${currentPoint.point_type}) with point_num=${currentPoint.point_num}`,
      )

      const targetPointNum = currentPoint.point_num + 1
      const targetPointIndex = points.findIndex((p) => p.point_num === targetPointNum)

      console.log(`Looking for point with point_num=${targetPointNum}, found at index=${targetPointIndex}`)

      if (targetPointIndex === -1) {
        console.log("❌ Cannot move down - no point with larger point_num found")
        return prev
      }

      const targetPoint = points[targetPointIndex]
      console.log(
        `Target point: ${targetPoint.point_id} (${targetPoint.point_type}) with point_num=${targetPoint.point_num}`,
      )

      points[pointIndex] = { ...currentPoint, point_num: targetPoint.point_num }
      points[targetPointIndex] = { ...targetPoint, point_num: currentPoint.point_num }

      console.log(
        "Points after movePointDown:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      updated[driverIndex].corrections[tripIndex].points = points
      return updated
    })
  }, [])

  const removePoint = useCallback((driverIndex: number, tripIndex: number, pointIndex: number) => {
    console.log(`🗑️ removePoint called: driverIndex=${driverIndex}, tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setDriverAssignments((prev) => {
      const updated = [...prev]
      const points = [...updated[driverIndex].corrections[tripIndex].points]

      console.log(
        "Points before removal:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      const removedPoint = points[pointIndex]
      console.log(
        `Removing point: ${removedPoint.point_id} (${removedPoint.point_type}) with point_num=${removedPoint.point_num}`,
      )

      const filteredPoints = points.filter((_, i) => i !== pointIndex)

      const recalculatedPoints = filteredPoints.map((point, index) => ({
        ...point,
        point_num: index + 1,
      }))

      console.log(
        "Points after removal and recalculation:",
        recalculatedPoints.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      updated[driverIndex].corrections[tripIndex].points = recalculatedPoints
      return updated
    })
  }, [])


  const loadDriverDetails = async () => {
    if (!phone || !tripId) {
      console.error("Cannot load driver details - phone or tripId missing")
      return
    }

    console.log(`Loading driver details for trip ${tripId}, phone ${phone}`)

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/driver-details?phone=${phone}`)
      console.log("API response status:", response.status)

      const data = await response.json()
      console.log("API response data:", data)

      if (data.success) {
        console.log("Successfully loaded driver details")
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

        console.log("Grouped driver data:", grouped)
        setDriverAssignments([{
          driver: {
            phone: phone,
            name: driverName || "Неизвестный",
            first_name: driverName,
            full_name: driverName,
          },
          corrections: Object.values(grouped)
        }])
      } else {
        console.error("API error:", data.error)
        setError(data.error || "Не удалось загрузить данные водителя")
      }
    } catch (error) {
      console.error("Error loading driver details:", error)
      setError("Ошибка при загрузке данных водителя")
    } finally {
      console.log("Finished loading driver details")
      setIsLoading(false)
      setDeletedTrips([])
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

   // Работа с рейсами и точками
  const updateTrip = useCallback((driverIndex: number, tripIndex: number, field: keyof CorrectionData, value: any) => {
    setDriverAssignments((prev) => {
      const updated = [...prev]
      updated[driverIndex].corrections[tripIndex] = {
        ...updated[driverIndex].corrections[tripIndex],
        [field]: value
      }
      return updated
    })
  }, [])

 const updatePoint = useCallback((driverIndex: number, tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => {
    console.log(
      `📝 updatePoint called: driverIndex=${driverIndex}, tripIndex=${tripIndex}, pointIndex=${pointIndex}, field=${field}, value=${value}`,
    )
    setDriverAssignments((prev) => {
      const updated = [...prev]
      updated[driverIndex].corrections[tripIndex].points[pointIndex] = {
        ...updated[driverIndex].corrections[tripIndex].points[pointIndex],
        [field]: value
      }
      return updated
    })
  }, [])

 const addNewPoint = (driverIndex: number, tripIndex: number) => {
    console.log(`➕ addNewPoint called: driverIndex=${driverIndex}, tripIndex=${tripIndex}`)

    const currentPoints = driverAssignments[driverIndex].corrections[tripIndex].points
    const maxPointNum = currentPoints.length > 0 ? Math.max(...currentPoints.map((p) => p.point_num || 0)) : 0

    console.log(`Current points count: ${currentPoints.length}, maxPointNum: ${maxPointNum}`)

    const newPoint: PointData = {
      point_type: "P",
      point_num: maxPointNum + 1,
      point_id: "",
      point_name: "",
      latitude: "",
      longitude: "",
    }

    console.log("Adding new point:", newPoint)

    setDriverAssignments((prev) => {
      const updated = [...prev]
      updated[driverIndex].corrections[tripIndex].points = [...updated[driverIndex].corrections[tripIndex].points, newPoint]
      return updated
    })
  }

 const addNewTrip = (driverIndex: number) => {
    console.log(`➕ addNewTrip called: driverIndex=${driverIndex}`)

    const newTrip: CorrectionData = {
      phone: driverAssignments[driverIndex].driver?.phone || "",
      trip_identifier: "",
      vehicle_number: "",
      planned_loading_time: new Date().toISOString(),
      driver_comment: "",
      message_id: 0,
      points: [createEmptyPoint()],
    }

    console.log("Adding new trip:", newTrip)
    setDriverAssignments((prev) => {
      const updated = [...prev]
      updated[driverIndex].corrections = [...updated[driverIndex].corrections, newTrip]
      return updated
    })
  }


  const removeTrip = (driverIndex: number, tripIndex: number) => {
    console.log(`🗑️ removeTrip called: driverIndex=${driverIndex}, tripIndex=${tripIndex}`)

    const tripIdentifier = driverAssignments[driverIndex].corrections[tripIndex].original_trip_identifier || 
                         driverAssignments[driverIndex].corrections[tripIndex].trip_identifier
    console.log(`Removing trip: ${tripIdentifier}`)

    setDriverAssignments((prev) => {
      const updated = [...prev]
      updated[driverIndex].corrections = updated[driverIndex].corrections.filter((_, i) => i !== tripIndex)
      return updated
    })
    if (tripIdentifier) {
      setDeletedTrips((prev) => [...prev, tripIdentifier])
    }
  }

    // Сохранение и отправка
  const saveCorrections = async () => {
    console.log("💾 saveCorrections called")

    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      // === ИЗМЕНЕНО: Формируем данные для всех водителей ===
      const tripData = driverAssignments.flatMap((assignment) =>
        assignment.corrections.map((trip) => ({
          phone: assignment.driver?.phone || "",
          trip_identifier: trip.trip_identifier,
          vehicle_number: trip.vehicle_number,
          planned_loading_time: trip.planned_loading_time,
          driver_comment: trip.driver_comment,
          loading_points: trip.points
            .filter((p) => p.point_type === "P")
            .map((p) => ({
              point_id: p.point_id,
              point_num: p.point_num,
              driver_phone: assignment.driver?.phone || "",
            })),
          unloading_points: trip.points
            .filter((p) => p.point_type === "D")
            .map((p) => ({
              point_id: p.point_id,
              point_num: p.point_num,
              driver_phone: assignment.driver?.phone || "",
            })),
        }))
      )

      console.log("Trip data to save:", tripData)

      const endpoint = mode === "edit" ? `/api/trips/${tripId}/save-corrections` : "/api/send-messages"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "edit"
            ? {
                phone,
                driver_phone: phone,
                corrections: driverAssignments[0].corrections.flatMap((trip) =>
                  trip.points.map((point) => ({
                    phone: trip.phone,
                    driver_phone: phone || driverAssignments[0].driver?.phone || "",
                    trip_identifier: trip.trip_identifier,
                    original_trip_identifier: trip.original_trip_identifier,
                    vehicle_number: trip.vehicle_number,
                    planned_loading_time: trip.planned_loading_time,
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
                deletedTrips,
              }
            : { tripData }
        ),
      })

      const data = await response.json()

      if (data.success) {
        console.log("✅ Save successful:", data)
        return { success: true, data }
      } else if (data.error === "trip_already_assigned") {
        setConflictedTrips(data.conflict_data || [])
        setError(`Конфликт рейсов: ${data.trip_identifiers?.join(", ") || "неизвестные рейсы"}`)
        return { success: false, conflict: true }
      } else {
        console.error("❌ Save failed:", data.error)
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
    console.log("📤 sendData called")

    setIsSending(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      const { success, data, conflict } = await saveCorrections()

      if (!success) {
        if (conflict) return
        throw new Error("Не удалось сохранить данные")
      }

      if (mode === "edit") {
        const messageIds = [...new Set(driverAssignments[0].corrections.map((c) => c.message_id))]
        console.log("Resending messages with IDs:", messageIds)

        const resendResponse = await fetch(`/api/trips/messages/${messageIds[0]}/resend-combined`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            driver_phone: phone,
            messageIds,
            isCorrection: true,
            deletedTrips,
          }),
        })

        const resendData = await resendResponse.json()
        if (resendData.success) {
          setSuccess("Корректировка отправлена водителю!")
          console.log("✅ Correction sent successfully")

          if (onCorrectionSent) {
            console.log("Calling onCorrectionSent callback")
            onCorrectionSent(driverAssignments[0].corrections, deletedTrips)
          }
        } else {
          console.error("❌ Resend failed:", resendData.error)
          setError(resendData.error || "Ошибка при отправке корректировки")
        }
      } else {
        setSuccess("Рассылка создана успешно!")
        console.log("✅ Assignment sent successfully")

        if (onAssignmentSent) {
          console.log("Calling onAssignmentSent callback")
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
    console.log("Opening conflict trip modal with:", conflict)

    // Закрываем текущую модалку
    onClose()

    // После закрытия открываем модалку редактирования
    setTimeout(() => {
      onOpenConflictTrip(conflict.trip_id, conflict.driver_phone, conflict.driver_name)
    }, 100)
  }

  // Форматирование данных
  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""

    try {
      if (dateString.includes("T")) {
        const [datePart, timePart] = dateString.split("T")
        const timeWithoutSeconds = timePart.split(":").slice(0, 2).join(":")
        return `${datePart}T${timeWithoutSeconds}`
      }

      if (dateString.includes("/") || dateString.includes("-")) {
        const dateMatch = dateString.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
        const timeMatch = dateString.match(/(\d{1,2}):(\d{2})/)

        if (dateMatch && timeMatch) {
          const [, day, month, year] = dateMatch
          const [, hours, minutes] = timeMatch

          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes}`
        }
      }

      return ""
    } catch (error) {
      console.error("Error formatting date:", error, "Input:", dateString)
      return ""
    }
  }

  const formatDateTimeForSave = (dateString: string) => {
    if (!dateString) return ""
    try {
      return dateString + ":00.000"
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

  // Выбор водителя
  const [driversList, setDriversList] = useState<Driver[]>([])

  useEffect(() => {
    if (mode === "create" && isOpen) {
      const loadDrivers = async () => {
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
      loadDrivers()
    }
  }, [mode, isOpen])

  const filteredDrivers = driversList.filter((driver) => {
    const search = driverSearchValue.toLowerCase()
    return (
      driver.phone.toLowerCase().includes(search) ||
      (driver.full_name || "").toLowerCase().includes(search) ||
      (driver.first_name || "").toLowerCase().includes(search)
    )
  })

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
            {driverAssignments.map((assignment, driverIndex) => (
              // === НОВЫЙ БЛОК: Форма для каждого водителя ===
              <div key={`driver-${driverIndex}`} className="border rounded-lg p-4 bg-gray-50 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-blue-900">
                      Водитель {driverIndex + 1}
                    </h3>
                  </div>
                  {mode === "create" && driverAssignments.length > 1 && (
                    <Button
                      variant="outline"
                      className="text-red-600 bg-transparent"
                      onClick={() => removeDriver(driverIndex)}
                    >
                      Удалить водителя
                    </Button>
                  )}
                </div>

                {mode === "create" && (
                  <div className="mb-4">
                    <Popover
                      open={driverSearchStates[`driver-${driverIndex}`]?.open || false}
                      onOpenChange={(open) => handleDriverSearchStateChange(driverIndex, { open })}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={driverSearchStates[`driver-${driverIndex}`]?.open || false}
                          className="w-full justify-between bg-transparent"
                        >
                          {assignment.driver?.phone
                            ? `${getDriverDisplayName(assignment.driver)} (${formatPhone(assignment.driver.phone)})`
                            : "Выберите водителя"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Поиск по имени или телефону..."
                            value={driverSearchStates[`driver-${driverIndex}`]?.search || ""}
                            onValueChange={(search) => handleDriverSearchStateChange(driverIndex, { search })}
                          />
                          <CommandList>
                            <CommandEmpty>Водители не найдены</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-auto">
                              {driversList
                                .filter((d) => d.verified)
                                .filter((driver) => {
                                  const search = (driverSearchStates[`driver-${driverIndex}`]?.search || "").toLowerCase()
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
                                      setDriverAssignments((prev) => {
                                        const updated = [...prev]
                                        updated[driverIndex].driver = driver
                                        updated[driverIndex].corrections = updated[driverIndex].corrections.map((trip) => ({
                                          ...trip,
                                          phone: driver.phone,
                                        }))
                                        return updated
                                      })
                                      handleDriverSearchStateChange(driverIndex, { open: false })
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

                <div className="flex justify-end mb-3">
                  <Button
                    onClick={() => addNewTrip(driverIndex)}
                    variant="outline"
                    className="text-green-600 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить новый рейс
                  </Button>
                </div>

                {assignment.corrections.map((trip, tripIndex) => (
                  <TripRow
                    key={trip.original_trip_identifier || `trip-${driverIndex}-${tripIndex}`}
                    trip={trip}
                    tripIndex={tripIndex}
                    driverIndex={driverIndex}
                    availablePoints={availablePoints}
                    pointSearchStates={pointSearchStates}
                    handleSearchStateChange={handleSearchStateChange}
                    updateTrip={updateTrip}
                    movePointUp={movePointUp}
                    movePointDown={movePointDown}
                    updatePoint={updatePoint}
                    addNewPoint={addNewPoint}
                    removePoint={removePoint}
                    removeTrip={removeTrip}
                    correctionsLength={assignment.corrections.length}
                    formatDateTime={formatDateTime}
                    formatDateTimeForSave={formatDateTimeForSave}
                  />
                ))}
              </div>
              // === КОНЕЦ НОВОГО БЛОКА ===
            ))}

            {mode === "create" && (
              // === НОВЫЙ БЛОК: Кнопка добавления нового водителя ===
              <div className="flex justify-end">
                <Button
                  onClick={addNewDriver}
                  variant="outline"
                  className="text-blue-600 bg-transparent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить водителя
                </Button>
              </div>
              // === КОНЕЦ НОВОГО БЛОКА ===
            )}

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
                  (mode === "create" && driverAssignments.some((assignment) => !assignment.driver?.phone))
                }
                title={
                  conflictedTrips.length > 0
                    ? "Сначала разрешите конфликты рейсов"
                    : mode === "create" && driverAssignments.some((assignment) => !assignment.driver?.phone)
                      ? "Выберите всех водителей"
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
