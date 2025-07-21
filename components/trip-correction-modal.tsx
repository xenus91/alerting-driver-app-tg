"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Send, Plus, AlertTriangle, User, ChevronsUpDown } from "lucide-react"
import { TripRow } from "./trip-row"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DriverAssignment {
  driver: Driver | null;
  trips: CorrectionData[];
}

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
  /* === НОВОЕ СОСТОЯНИЕ === */
  /* Заменяем отдельные состояния driver и corrections на assignments */
  /* Теперь храним массив объектов с водителем и его рейсами */
  const [assignments, setAssignments] = useState<DriverAssignment[]>([])
  const [currentDriverIndex, setCurrentDriverIndex] = useState(0)
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
  const [driverSearchOpen, setDriverSearchOpen] = useState(false)
  const [driverSearchValue, setDriverSearchValue] = useState("")

    // Получаем текущего водителя и его рейсы
  const currentAssignment = assignments[currentDriverIndex] || { 
    driver: null, 
    trips: [] 
  }

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
        // Режим редактирования - один водитель
        setAssignments([{
          driver: {
            phone: phone || "",
            name: driverName || "Неизвестный",
            first_name: driverName,
            full_name: driverName,
          },
          trips: []
        }])
        loadDriverDetails()
      } else {
        // Режим создания - поддерживаем несколько водителей
        const initialAssignments = []

        if (initialDriver && initialTrips) {
          // Если есть начальные данные
          initialAssignments.push({
            driver: initialDriver,
            trips: initialTrips.map(trip => ({
              phone: initialDriver.phone,
              trip_identifier: trip.trip_identifier,
              vehicle_number: trip.vehicle_number,
              planned_loading_time: trip.planned_loading_time,
              driver_comment: trip.driver_comment || "",
              message_id: 0,
              points: trip.points || [createEmptyPoint()],
            }))
          })
        } else {
          // Пустой водитель и один рейс
          initialAssignments.push({
            driver: createEmptyDriver(),
            trips: [createEmptyTrip()]
          })
        }

        setAssignments(initialAssignments)
        setCurrentDriverIndex(0)
      }

      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone, driverName, mode, initialDriver, initialTrips])


   /* === НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ВОДИТЕЛЯМИ === */
  const addNewDriver = () => {
    setAssignments(prev => [
      ...prev,
      {
        driver: createEmptyDriver(),
        trips: [createEmptyTrip()]
      }
    ])
    setCurrentDriverIndex(assignments.length)
  }

  const removeDriver = (index: number) => {
    if (assignments.length <= 1) return;
    
    setAssignments(prev => prev.filter((_, i) => i !== index));
    setCurrentDriverIndex(prev => {
      if (index === prev) return 0;
      return prev > index ? prev - 1 : prev;
    });
  }

  const updateDriver = (index: number, driver: Driver | null) => {
    setAssignments(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        driver,
        // Обновляем телефон во всех рейсах водителя
        trips: updated[index].trips.map(trip => ({
          ...trip,
          phone: driver?.phone || ""
        }))
      };
      return updated;
    });
  }

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
    phone: driver?.phone || "",
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString(),
    driver_comment: "",
    message_id: 0,
    points: [createEmptyPoint()],
  })

  // Функции перемещения точек - правильная логика
  const movePointUp = useCallback((tripIndex: number, pointIndex: number) => {
    console.log(`🔼 movePointUp called: tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setCorrections((prev) => {
      const updated = [...prev]
      const points = [...updated[tripIndex].points]

      console.log(
        "Points before movePointUp:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      const currentPoint = points[pointIndex]
      console.log(
        `Current point: ${currentPoint.point_id} (${currentPoint.point_type}) with point_num=${currentPoint.point_num}`,
      )

      // Находим точку с point_num на 1 меньше
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

      // Меняем point_num местами
      const newCurrentPointNum = targetPoint.point_num
      const newTargetPointNum = currentPoint.point_num

      points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
      points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

      console.log(
        "Points after movePointUp:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      updated[tripIndex].points = points
      return updated
    })
  }, [])

  const movePointDown = useCallback((tripIndex: number, pointIndex: number) => {
    console.log(`🔽 movePointDown called: tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setCorrections((prev) => {
      const updated = [...prev]
      const points = [...updated[tripIndex].points]

      console.log(
        "Points before movePointDown:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      const currentPoint = points[pointIndex]
      console.log(
        `Current point: ${currentPoint.point_id} (${currentPoint.point_type}) with point_num=${currentPoint.point_num}`,
      )

      // Находим точку с point_num на 1 больше
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

      // Меняем point_num местами
      const newCurrentPointNum = targetPoint.point_num
      const newTargetPointNum = currentPoint.point_num

      points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
      points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

      console.log(
        "Points after movePointDown:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      updated[tripIndex].points = points
      return updated
    })
  }, [])

  // Обновленная функция удаления точки с пересчетом
  const removePoint = useCallback((tripIndex: number, pointIndex: number) => {
    console.log(`🗑️ removePoint called: tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setCorrections((prev) => {
      const updated = [...prev]
      const points = [...updated[tripIndex].points]

      console.log(
        "Points before removal:",
        points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      const removedPoint = points[pointIndex]
      console.log(
        `Removing point: ${removedPoint.point_id} (${removedPoint.point_type}) with point_num=${removedPoint.point_num}`,
      )

      // Удаляем точку
      const filteredPoints = points.filter((_, i) => i !== pointIndex)

      // Пересчитываем point_num для всех точек
      const recalculatedPoints = filteredPoints.map((point, index) => ({
        ...point,
        point_num: index + 1,
      }))

      console.log(
        "Points after removal and recalculation:",
        recalculatedPoints.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
      )

      updated[tripIndex].points = recalculatedPoints
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
        setCorrections(Object.values(grouped))
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

  const updateTrip = useCallback((tripIndex: number, field: keyof CorrectionData, value: any) => {
    setAssignments(prev => {
      const updated = [...prev];
      updated[currentDriverIndex].trips[tripIndex] = { 
        ...updated[currentDriverIndex].trips[tripIndex], 
        [field]: value 
      };
      return updated;
    });
  }, [currentDriverIndex]);

  const updatePoint = useCallback((tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => {
    setAssignments(prev => {
      const updated = [...prev];
      const points = [...updated[currentDriverIndex].trips[tripIndex].points];
      points[pointIndex] = { ...points[pointIndex], [field]: value };
      updated[currentDriverIndex].trips[tripIndex].points = points;
      return updated;
    });
  }, [currentDriverIndex]);

  const addNewPoint = (tripIndex: number) => {
    console.log(`➕ addNewPoint called: tripIndex=${tripIndex}`)

    const currentPoints = corrections[tripIndex].points
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

    setCorrections((prev) => {
      const updated = [...prev]
      updated[tripIndex].points = [...updated[tripIndex].points, newPoint]
      return updated
    })
  }

  const addNewTrip = () => {
    setAssignments(prev => {
      const updated = [...prev];
      updated[currentDriverIndex].trips = [
        ...updated[currentDriverIndex].trips,
        createEmptyTripForDriver(updated[currentDriverIndex].driver)
      ];
      return updated;
    });
  }

  const removeTrip = (tripIndex: number) => {
    setAssignments(prev => {
      const updated = [...prev];
      const tripIdentifier = updated[currentDriverIndex].trips[tripIndex].original_trip_identifier || 
                             updated[currentDriverIndex].trips[tripIndex].trip_identifier;
      
      if (tripIdentifier) {
        setDeletedTrips(prev => [...prev, tripIdentifier]);
      }
      
      updated[currentDriverIndex].trips = updated[currentDriverIndex].trips.filter((_, i) => i !== tripIndex);
      return updated;
    });
  }

  // Сохранение и отправка
  const saveCorrections = async () => {
    console.log("💾 saveCorrections called")

    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      const allTrips = assignments.flatMap(assignment => 
        assignment.trips.flatMap(trip =>
          trip.points.map(point => ({
          phone: trip.phone,
          driver_phone: mode === 'edit' ? phone : assignment.driver?.phone || "",
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
      )

      console.log("Flat corrections to save:", flatCorrections)

      const endpoint = mode === "edit" ? `/api/trips/${tripId}/save-corrections` : "/api/send-messages"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "edit"
            ? {
                phone,
                driver_phone: phone,
                corrections: flatCorrections,
                deletedTrips,
              }
            : {
                tripData: corrections.map((trip) => ({
                  phone: driver?.phone || "",
                  trip_identifier: trip.trip_identifier,
                  vehicle_number: trip.vehicle_number,
                  planned_loading_time: trip.planned_loading_time,
                  driver_comment: trip.driver_comment,
                  loading_points: trip.points
                    .filter((p) => p.point_type === "P")
                    .map((p) => ({
                      point_id: p.point_id,
                      point_num: p.point_num,
                      driver_phone: driver?.phone || "",
                    })),
                  unloading_points: trip.points
                    .filter((p) => p.point_type === "D")
                    .map((p) => ({
                      point_id: p.point_id,
                      point_num: p.point_num,
                      driver_phone: driver?.phone || "",
                    })),
                })),
              },
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
        const messageIds = [...new Set(corrections.map((c) => c.message_id))]
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

          // Исправляем вызов onCorrectionSent - убираем несуществующий loadTripDetails
          if (onCorrectionSent) {
            console.log("Calling onCorrectionSent callback")
            onCorrectionSent(corrections, deletedTrips)
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
          {mode === "edit" 
            ? `Корректировка рейсов для ${driverName}` 
            : "Создание новых рейсов"}
        </DialogTitle>
      </DialogHeader>

      {/* Предупреждение для режима редактирования */}
      {mode === "edit" && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Внимание:</strong> При отправке корректировки статус подтверждения рейсов будет сброшен.
          </AlertDescription>
        </Alert>
      )}

      {/* Общие ошибки */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Конфликты рейсов */}
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

      {/* Успешное выполнение */}
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
          {/* === БЛОК ДЛЯ РЕЖИМА СОЗДАНИЯ: УПРАВЛЕНИЕ ВОДИТЕЛЯМИ === */}
          {mode === "create" && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Управление водителями</h3>
                </div>
                
                <Button onClick={addNewDriver} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить водителя
                </Button>
              </div>

              {/* Вкладки водителей */}
              <div className="flex flex-wrap gap-2 mb-4">
                {assignments.map((assignment, index) => (
                  <div 
                    key={index}
                    className={`relative rounded-lg px-3 py-2 text-sm cursor-pointer
                      ${currentDriverIndex === index 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-300 hover:bg-gray-100'}`}
                    onClick={() => setCurrentDriverIndex(index)}
                  >
                    {assignment.driver?.phone 
                      ? `${getDriverDisplayName(assignment.driver)} (${formatPhone(assignment.driver.phone)})`
                      : `Водитель ${index + 1}`}
                    
                    {assignments.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDriver(index);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Выбор водителя для текущей вкладки */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-gray-700">Выберите водителя:</h4>
                <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={driverSearchOpen}
                      className="w-full justify-between bg-transparent"
                    >
                      {currentAssignment.driver?.phone
                        ? `${getDriverDisplayName(currentAssignment.driver)} (${formatPhone(currentAssignment.driver.phone)})`
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
                          {filteredDrivers.map((driver) => (
                            <CommandItem
                              key={driver.phone}
                              value={`${getDriverDisplayName(driver)} ${driver.phone}`}
                              onSelect={() => {
                                updateDriver(currentDriverIndex, driver);
                                setDriverSearchOpen(false);
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
            </div>
          )}

          {/* === БЛОК РЕЙСОВ ДЛЯ ТЕКУЩЕГО ВОДИТЕЛЯ === */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">
                {mode === "edit" 
                  ? `Рейсы для ${driverName}` 
                  : `Рейсы для ${currentAssignment.driver ? getDriverDisplayName(currentAssignment.driver) : "нового водителя"}`}
              </h3>
              
              <Button onClick={addNewTrip} variant="outline" className="text-green-600 bg-transparent">
                <Plus className="h-4 w-4 mr-2" />
                Добавить рейс
              </Button>
            </div>

            {/* Список рейсов для текущего водителя */}
            {currentAssignment.trips.map((trip, tripIndex) => (
              <TripRow
                key={trip.original_trip_identifier || `trip-${currentDriverIndex}-${tripIndex}`}
                trip={trip}
                tripIndex={tripIndex}
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
                correctionsLength={currentAssignment.trips.length}
                formatDateTime={formatDateTime}
                formatDateTimeForSave={formatDateTimeForSave}
              />
            ))}
          </div>

          {/* Кнопки действий */}
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
                (mode === "create" && assignments.some(a => !a.driver?.phone)) ||
                (mode === "create" && assignments.some(a => a.trips.length === 0))
              }
              title={
                conflictedTrips.length > 0
                  ? "Сначала разрешите конфликты рейсов"
                  : mode === "create" && assignments.some(a => !a.driver?.phone)
                    ? "Выберите водителя для всех назначений"
                    : mode === "create" && assignments.some(a => a.trips.length === 0)
                      ? "Добавьте рейсы для всех водителей"
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
