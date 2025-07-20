"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Send, Plus, AlertTriangle, User, ChevronsUpDown } from "lucide-react"
import { TripRow } from "./trip-row"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
  interface DriverTripGroup {
    id: string
    driver: Driver | null
    trips: CorrectionData[]
  }

  const [driverTripGroups, setDriverTripGroups] = useState<DriverTripGroup[]>([])
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

  const createEmptyTrip = (phone: string): CorrectionData => ({
    phone: phone, // Use the provided phone
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString(),
    driver_comment: "",
    message_id: 0,
    points: [createEmptyPoint()],
  })

  const loadDriverDetails = useCallback(async () => {
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
        setDriverTripGroups([
          {
            id: uuidv4(), // Generate a unique ID for this group
            driver: { phone: phone, name: driverName || "Неизвестный", first_name: driverName, full_name: driverName },
            trips: Object.values(grouped),
          },
        ])
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
  }, [phone, tripId, driverName])

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

        loadDriverDetails() // This function will now set driverTripGroups
      } else {
        console.log("Initializing create mode")
        if (initialDriver || (initialTrips && initialTrips.length > 0)) {
          console.log("Using initial driver/trips for create mode")
          setDriverTripGroups([
            {
              id: uuidv4(),
              driver: initialDriver || createEmptyDriver(),
              trips:
                initialTrips && initialTrips.length > 0
                  ? initialTrips.map((trip) => ({
                      phone: initialDriver?.phone || "",
                      trip_identifier: trip.trip_identifier,
                      original_trip_identifier: trip.trip_identifier,
                      vehicle_number: trip.vehicle_number,
                      planned_loading_time: trip.planned_loading_time,
                      driver_comment: trip.driver_comment || "",
                      message_id: 0,
                      points: trip.points || [createEmptyPoint()],
                    }))
                  : [createEmptyTrip(initialDriver?.phone || "")],
            },
          ])
        } else {
          console.log("Creating empty driver group for create mode")
          setDriverTripGroups([
            {
              id: uuidv4(),
              driver: createEmptyDriver(),
              trips: [createEmptyTrip("")],
            },
          ])
        }
      }

      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone, driverName, mode, initialDriver, initialTrips])

  // Работа с рейсами и точками
  const updateTrip = useCallback((groupId: string, tripIndex: number, field: keyof CorrectionData, value: any) => {
    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = [...group.trips]
          updatedTrips[tripIndex] = { ...updatedTrips[tripIndex], [field]: value }
          return { ...group, trips: updatedTrips }
        }
        return group
      })
      return updatedGroups
    })
  }, [])

  const updatePoint = useCallback(
    (groupId: string, tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => {
      console.log(
        `📝 updatePoint called: groupId=${groupId}, tripIndex=${tripIndex}, pointIndex=${pointIndex}, field=${field}, value=${value}`,
      )
      setDriverTripGroups((prevGroups) => {
        const updatedGroups = prevGroups.map((group) => {
          if (group.id === groupId) {
            const updatedTrips = [...group.trips]
            updatedTrips[tripIndex].points[pointIndex] = {
              ...updatedTrips[tripIndex].points[pointIndex],
              [field]: value,
            }
            return { ...group, trips: updatedTrips }
          }
          return group
        })
        return updatedGroups
      })
    },
    [],
  )

  const addNewPoint = (groupId: string, tripIndex: number) => {
    console.log(`➕ addNewPoint called: groupId=${groupId}, tripIndex=${tripIndex}`)

    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = [...group.trips]
          const currentPoints = updatedTrips[tripIndex].points
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

          updatedTrips[tripIndex].points = [...currentPoints, newPoint]
          return { ...group, trips: updatedTrips }
        }
        return group
      })
      return updatedGroups
    })
  }

  const addNewTrip = (groupId: string) => {
    console.log(`➕ addNewTrip called for group: ${groupId}`)

    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const newTrip = createEmptyTrip(group.driver?.phone || "")
          console.log("Adding new trip:", newTrip)
          return { ...group, trips: [...group.trips, newTrip] }
        }
        return group
      })
      return updatedGroups
    })
  }

  const removeTrip = (groupId: string, tripIndex: number) => {
    console.log(`🗑️ removeTrip called: groupId=${groupId}, tripIndex=${tripIndex}`)

    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const tripIdentifier =
            group.trips[tripIndex].original_trip_identifier || group.trips[tripIndex].trip_identifier
          console.log(`Removing trip: ${tripIdentifier}`)

          if (tripIdentifier) {
            setDeletedTrips((prev) => [...prev, tripIdentifier])
          }
          return { ...group, trips: group.trips.filter((_, i) => i !== tripIndex) }
        }
        return group
      })
      return updatedGroups
    })
  }

  const addNewDriverGroup = () => {
    console.log("➕ addNewDriverGroup called")
    setDriverTripGroups((prev) => [
      ...prev,
      {
        id: uuidv4(),
        driver: createEmptyDriver(),
        trips: [createEmptyTrip("")], // Start with one empty trip for the new driver
      },
    ])
  }

  const removeDriverGroup = (groupId: string) => {
    console.log(`🗑️ removeDriverGroup called: groupId=${groupId}`)
    setDriverTripGroups((prev) => {
      const groupToRemove = prev.find((group) => group.id === groupId)
      if (groupToRemove) {
        // Add all trips from this group to deletedTrips if they had an original_trip_identifier
        setDeletedTrips((currentDeleted) => [
          ...currentDeleted,
          ...groupToRemove.trips.filter((t) => t.original_trip_identifier).map((t) => t.original_trip_identifier!),
        ])
      }
      return prev.filter((group) => group.id !== groupId)
    })
  }

  // Сохранение и отправка
  const saveCorrections = async () => {
    console.log("💾 saveCorrections called")

    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      let endpoint: string
      let body: any
      let identifiersToCheck: string[] = []
      let currentPhone: string | undefined

      if (mode === "edit") {
        const currentGroup = driverTripGroups[0] // In edit mode, there's only one group
        if (!currentGroup || !currentGroup.driver?.phone) {
          setError("Водитель не выбран для корректировки.")
          return { success: false }
        }
        currentPhone = currentGroup.driver.phone

        const flatCorrections = currentGroup.trips.flatMap((trip) =>
          trip.points.map((point) => ({
            phone: currentGroup.driver!.phone,
            driver_phone: currentGroup.driver!.phone,
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

        endpoint = `/api/trips/${tripId}/save-corrections`
        body = {
          phone: currentGroup.driver!.phone,
          driver_phone: currentGroup.driver!.phone,
          corrections: flatCorrections,
          deletedTrips,
        }
        identifiersToCheck = [...deletedTrips, ...flatCorrections.map((c) => String(c.trip_identifier))]
      } else {
        // mode === "create"
        const tripDataForSendMessages = driverTripGroups.flatMap((group) => {
          if (!group.driver?.phone) {
            setError("Для всех групп рейсов должен быть выбран водитель.")
            return []
          }
          if (group.trips.length === 0) {
            setError(`Группа для водителя ${group.driver.full_name || group.driver.phone} не содержит рейсов.`)
            return []
          }
          return group.trips.map((trip) => ({
            phone: group.driver!.phone,
            trip_identifier: trip.trip_identifier,
            vehicle_number: trip.vehicle_number,
            planned_loading_time: trip.planned_loading_time,
            driver_comment: trip.driver_comment,
            loading_points: trip.points
              .filter((p) => p.point_type === "P")
              .map((p) => ({
                point_id: p.point_id,
                point_num: p.point_num,
                driver_phone: group.driver!.phone,
              })),
            unloading_points: trip.points
              .filter((p) => p.point_type === "D")
              .map((p) => ({
                point_id: p.point_id,
                point_num: p.point_num,
                driver_phone: group.driver!.phone,
              })),
          }))
        })

        if (
          tripDataForSendMessages.length === 0 &&
          driverTripGroups.some((g) => !g.driver?.phone || g.trips.length === 0)
        ) {
          return { success: false } // Error already set by checks above
        }

        endpoint = "/api/send-messages"
        body = { tripData: tripDataForSendMessages }
        identifiersToCheck = tripDataForSendMessages.map((t) => String(t.trip_identifier))
      }

      // Perform conflict check before sending
      if (identifiersToCheck.length > 0) {
        console.log(`Checking conflicts for identifiers: ${identifiersToCheck.join(", ")}`)
        const conflictCheckResponse = await fetch("/api/trips/check-conflicts", {
          // New API endpoint for conflict check
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trip_identifiers: identifiersToCheck,
            exclude_phone: mode === "edit" ? currentPhone : undefined, // Exclude current driver in edit mode
          }),
        })
        const conflictCheckData = await conflictCheckResponse.json()

        if (conflictCheckData.success === false && conflictCheckData.error === "trip_already_assigned") {
          setConflictedTrips(conflictCheckData.conflict_data || [])
          setError(`Конфликт рейсов: ${conflictCheckData.trip_identifiers?.join(", ") || "неизвестные рейсы"}`)
          return { success: false, conflict: true }
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        console.log("✅ Save successful:", data)
        return { success: true, data }
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
        const currentGroup = driverTripGroups[0]
        if (!currentGroup || !currentGroup.driver?.phone) {
          throw new Error("Водитель не выбран для корректировки.")
        }
        const messageIds = [...new Set(currentGroup.trips.map((c) => c.message_id))]
        console.log("Resending messages with IDs:", messageIds)

        const resendResponse = await fetch(`/api/trips/messages/${messageIds[0]}/resend-combined`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: currentGroup.driver.phone,
            driver_phone: currentGroup.driver.phone,
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
            onCorrectionSent(currentGroup.trips, deletedTrips)
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

  // Функции перемещения точек - правильная логика
  const movePointUp = useCallback((groupId: string, tripIndex: number, pointIndex: number) => {
    console.log(`🔼 movePointUp called: groupId=${groupId}, tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = [...group.trips]
          const points = [...updatedTrips[tripIndex].points]

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
            return group // Return original group if no change
          }

          const targetPoint = points[targetPointIndex]
          console.log(
            `Target point: ${targetPoint.point_id} (${targetPoint.point_type}) with point_num=${targetPoint.point_num}`,
          )

          const newCurrentPointNum = targetPoint.point_num
          const newTargetPointNum = currentPoint.point_num

          points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
          points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

          console.log(
            "Points after movePointUp:",
            points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
          )

          updatedTrips[tripIndex].points = points
          return { ...group, trips: updatedTrips }
        }
        return group
      })
      return updatedGroups
    })
  }, [])

  const movePointDown = useCallback((groupId: string, tripIndex: number, pointIndex: number) => {
    console.log(`🔽 movePointDown called: groupId=${groupId}, tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = [...group.trips]
          const points = [...updatedTrips[tripIndex].points]

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
            return group // Return original group if no change
          }

          const targetPoint = points[targetPointIndex]
          console.log(
            `Target point: ${targetPoint.point_id} (${targetPoint.point_type}) with point_num=${targetPoint.point_num}`,
          )

          const newCurrentPointNum = targetPoint.point_num
          const newTargetPointNum = currentPoint.point_num

          points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
          points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

          console.log(
            "Points after movePointDown:",
            points.map((p) => ({ point_num: p.point_num, point_id: p.point_id, point_type: p.point_type })),
          )

          updatedTrips[tripIndex].points = points
          return { ...group, trips: updatedTrips }
        }
        return group
      })
      return updatedGroups
    })
  }, [])

  const removePoint = useCallback((groupId: string, tripIndex: number, pointIndex: number) => {
    console.log(`🗑️ removePoint called: groupId=${groupId}, tripIndex=${tripIndex}, pointIndex=${pointIndex}`)

    setDriverTripGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = [...group.trips]
          const points = [...updatedTrips[tripIndex].points]

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

          updatedTrips[tripIndex].points = recalculatedPoints
          return { ...group, trips: updatedTrips }
        }
        return group
      })
      return updatedGroups
    })
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? `Корректировка рейсов для ${driverName}` : "Создание новых рейсов"}
          </DialogTitle>
        </DialogHeader>

        {mode === "edit" && (
          <div className="border rounded-lg p-4 bg-gray-50 shadow-sm mb-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Внимание:</strong> При отправке корректировки статус подтверждения рейсов будет сброшен.
              </AlertDescription>
            </Alert>
          </div>
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
                      {conflict.trip_identifier} (Водитель: {conflict.driver_name}, Номер рассылки: {conflict.trip_id})
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
          <div className="space-y-8">
            {" "}
            {/* Increased spacing for driver groups */}
            {mode === "create" && (
              <div className="flex justify-end mb-4">
                <Button onClick={addNewDriverGroup} variant="outline" className="text-blue-600 bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить нового водителя
                </Button>
              </div>
            )}
            {driverTripGroups.map((group, groupIndex) => (
              <div key={group.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-700" />
                    Группа рейсов для водителя{" "}
                    {group.driver?.full_name || group.driver?.first_name || group.driver?.name || "Не выбран"}
                  </h3>
                  {driverTripGroups.length > 1 && (
                    <Button variant="destructive" size="sm" onClick={() => removeDriverGroup(group.id)}>
                      Удалить группу
                    </Button>
                  )}
                </div>

                {mode === "create" && (
                  <div className="border rounded-lg p-4 bg-blue-50 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-blue-900">Выбор водителя для этой группы</h3>
                    </div>

                    <Popover
                      open={pointSearchStates[`driver-${group.id}`]?.open}
                      onOpenChange={(open) => handleSearchStateChange(`driver-${group.id}`, { open })}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={pointSearchStates[`driver-${group.id}`]?.open}
                          className="w-full justify-between bg-transparent"
                        >
                          {group.driver?.phone
                            ? `${getDriverDisplayName(group.driver)} (${formatPhone(group.driver.phone)})`
                            : "Выберите водителя"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="max-h-[300px] overflow-auto">
                          {filteredDrivers.map((driverOption) => (
                            <div
                              key={driverOption.phone}
                              className="flex flex-col p-2 cursor-pointer hover:bg-blue-100"
                              onClick={() => {
                                setDriverTripGroups((prevGroups) =>
                                  prevGroups.map((g) =>
                                    g.id === group.id
                                      ? {
                                          ...g,
                                          driver: driverOption,
                                          trips: g.trips.map((t) => ({ ...t, phone: driverOption.phone })),
                                        }
                                      : g,
                                  ),
                                )
                                handleSearchStateChange(`driver-${group.id}`, { open: false })
                              }}
                            >
                              <span>{getDriverDisplayName(driverOption)}</span>
                              <span className="text-sm text-gray-500">{formatPhone(driverOption.phone)}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="flex justify-end mb-4">
                  <Button
                    onClick={() => addNewTrip(group.id)}
                    variant="outline"
                    className="text-green-600 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить новый рейс для этого водителя
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
                    updateTrip={(field, value) => updateTrip(group.id, tripIndex, field, value)}
                    movePointUp={(pointIdx) => movePointUp(group.id, tripIndex, pointIdx)}
                    movePointDown={(pointIdx) => movePointDown(group.id, tripIndex, pointIdx)}
                    updatePoint={(pointIdx, field, value) => updatePoint(group.id, tripIndex, pointIdx, field, value)}
                    addNewPoint={() => addNewPoint(group.id, tripIndex)}
                    removePoint={(pointIdx) => removePoint(group.id, tripIndex, pointIdx)}
                    removeTrip={() => removeTrip(group.id, tripIndex)}
                    correctionsLength={group.trips.length} // Pass the length of trips in this group
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
                  driverTripGroups.some((g) => !g.driver?.phone || g.trips.length === 0)
                }
                title={
                  conflictedTrips.length > 0
                    ? "Сначала разрешите конфликты рейсов"
                    : driverTripGroups.some((g) => !g.driver?.phone)
                      ? "Для всех групп рейсов должен быть выбран водитель"
                      : driverTripGroups.some((g) => g.trips.length === 0)
                        ? "Каждая группа должна содержать хотя бы один рейс"
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
