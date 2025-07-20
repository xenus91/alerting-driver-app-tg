"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Send, Plus, AlertTriangle, User, ChevronsUpDown, XCircle } from "lucide-react"
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

interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  points?: PointData[]
}

// New interface for grouping trips by driver
interface DriverAssignment {
  id: string // Unique ID for React keys
  driver: Driver | null
  trips: CorrectionData[]
  deletedTrips: string[] // Trips marked for deletion within this specific driver's assignment
  driverSearchOpen: boolean // State for the driver selection popover
  driverSearchValue: string // Search input for the driver selection popover
}

interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: "edit" | "create"
  // Для режима редактирования
  tripId?: number
  phone?: string
  driverName?: string
  // Для режима создания (теперь поддерживает несколько начальных назначений)
  initialAssignments?: Array<{ driver: Driver; trips: TripData[] }> // Изменено
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
  initialAssignments, // Changed
  onCorrectionSent,
  onAssignmentSent,
  onOpenConflictTrip,
}: TripCorrectionModalProps) {
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]) // New state
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
  const [driversList, setDriversList] = useState<Driver[]>([]) // Keep global list of drivers

  // Helper to generate unique IDs for assignments
  const generateUniqueId = () =>
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

  // Helper to create an empty point (remains the same)
  const createEmptyPoint = (): PointData => ({
    point_type: "P",
    point_num: 1,
    point_id: "",
    point_name: "",
    latitude: "",
    longitude: "",
  })

  // Helper to create an empty trip (phone will be set by driver selection)
  const createEmptyTrip = (): CorrectionData => ({
    phone: "", // Will be updated when driver is selected
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString(),
    driver_comment: "",
    message_id: 0,
    points: [createEmptyPoint()],
  })

  // Helper to create an empty driver assignment block
  const createEmptyDriverAssignment = (): DriverAssignment => ({
    id: generateUniqueId(),
    driver: null,
    trips: [createEmptyTrip()],
    deletedTrips: [],
    driverSearchOpen: false,
    driverSearchValue: "",
  })

  useEffect(() => {
    console.log("TripCorrectionModal useEffect:", {
      isOpen,
      mode,
      tripId,
      phone,
      driverName,
      initialAssignments,
    })

    if (isOpen) {
      setConflictedTrips([])
      setError(null)
      setSuccess(null)

      if (mode === "edit") {
        console.log("Loading driver details for edit mode", { tripId, phone })
        if (!phone || !tripId) {
          console.error("Phone or tripId missing for edit mode")
          return
        }
        // Load details for the single driver being edited
        loadDriverDetailsForEditMode(tripId, phone, driverName || "Неизвестный")
      } else {
        console.log("Initializing create mode")
        if (initialAssignments && initialAssignments.length > 0) {
          console.log("Using initial assignments:", initialAssignments)
          const newAssignments: DriverAssignment[] = initialAssignments.map((initialAssignment) => ({
            id: generateUniqueId(),
            driver: initialAssignment.driver,
            trips: initialAssignment.trips.map((trip) => ({
              phone: initialAssignment.driver?.phone || "",
              trip_identifier: trip.trip_identifier,
              original_trip_identifier: trip.trip_identifier,
              vehicle_number: trip.vehicle_number,
              planned_loading_time: trip.planned_loading_time,
              driver_comment: trip.driver_comment || "",
              message_id: 0,
              points: trip.points || [createEmptyPoint()],
            })),
            deletedTrips: [],
            driverSearchOpen: false,
            driverSearchValue: "",
          }))
          setDriverAssignments(newAssignments)
        } else {
          console.log("Creating empty driver assignment")
          setDriverAssignments([createEmptyDriverAssignment()])
        }
      }
      loadAvailablePoints()
    }
  }, [isOpen, tripId, phone, driverName, mode, initialAssignments])

  const loadDriverDetailsForEditMode = async (
    currentTripId: number,
    currentPhone: string,
    currentDriverName: string,
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${currentTripId}/driver-details?phone=${currentPhone}`)
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

        setDriverAssignments([
          {
            id: generateUniqueId(),
            driver: {
              phone: currentPhone,
              name: currentDriverName,
              first_name: currentDriverName,
              full_name: currentDriverName,
            },
            trips: Object.values(grouped),
            deletedTrips: [],
            driverSearchOpen: false,
            driverSearchValue: "",
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

  // Functions for moving/removing points, now accepting assignmentIndex
  const movePointUp = useCallback((assignmentIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      const points = [...assignment.trips[tripIndex].points]

      const currentPoint = points[pointIndex]
      const targetPointNum = currentPoint.point_num - 1
      const targetPointIndex = points.findIndex((p) => p.point_num === targetPointNum)

      if (targetPointIndex === -1) return prevAssignments

      const targetPoint = points[targetPointIndex]
      const newCurrentPointNum = targetPoint.point_num
      const newTargetPointNum = currentPoint.point_num

      points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
      points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

      assignment.trips[tripIndex].points = points
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }, [])

  const movePointDown = useCallback((assignmentIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      const points = [...assignment.trips[tripIndex].points]

      const currentPoint = points[pointIndex]
      const targetPointNum = currentPoint.point_num + 1
      const targetPointIndex = points.findIndex((p) => p.point_num === targetPointNum)

      if (targetPointIndex === -1) return prevAssignments

      const targetPoint = points[targetPointIndex]
      const newCurrentPointNum = targetPoint.point_num
      const newTargetPointNum = currentPoint.point_num

      points[pointIndex] = { ...currentPoint, point_num: newCurrentPointNum }
      points[targetPointIndex] = { ...targetPoint, point_num: newTargetPointNum }

      assignment.trips[tripIndex].points = points
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }, [])

  const removePoint = useCallback((assignmentIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      const points = [...assignment.trips[tripIndex].points]

      const filteredPoints = points.filter((_, i) => i !== pointIndex)
      const recalculatedPoints = filteredPoints.map((point, index) => ({
        ...point,
        point_num: index + 1,
      }))

      assignment.trips[tripIndex].points = recalculatedPoints
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }, [])

  // Update trip and point data within a specific assignment
  const updateTrip = useCallback(
    (assignmentIndex: number, tripIndex: number, field: keyof CorrectionData, value: any) => {
      setDriverAssignments((prevAssignments) => {
        const updatedAssignments = [...prevAssignments]
        const assignment = { ...updatedAssignments[assignmentIndex] }
        assignment.trips[tripIndex] = { ...assignment.trips[tripIndex], [field]: value }
        updatedAssignments[assignmentIndex] = assignment
        return updatedAssignments
      })
    },
    [],
  )

  const updatePoint = useCallback(
    (assignmentIndex: number, tripIndex: number, pointIndex: number, field: keyof PointData, value: any) => {
      setDriverAssignments((prevAssignments) => {
        const updatedAssignments = [...prevAssignments]
        const assignment = { ...updatedAssignments[assignmentIndex] }
        assignment.trips[tripIndex].points[pointIndex] = {
          ...assignment.trips[tripIndex].points[pointIndex],
          [field]: value,
        }
        updatedAssignments[assignmentIndex] = assignment
        return updatedAssignments
      })
    },
    [],
  )

  const addNewPoint = (assignmentIndex: number, tripIndex: number) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      const currentPoints = assignment.trips[tripIndex].points
      const maxPointNum = currentPoints.length > 0 ? Math.max(...currentPoints.map((p) => p.point_num || 0)) : 0

      const newPoint: PointData = {
        point_type: "P",
        point_num: maxPointNum + 1,
        point_id: "",
        point_name: "",
        latitude: "",
        longitude: "",
      }

      assignment.trips[tripIndex].points = [...currentPoints, newPoint]
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }

  const addNewTripToDriver = (assignmentIndex: number) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      const newTrip: CorrectionData = {
        phone: assignment.driver?.phone || "",
        trip_identifier: "",
        vehicle_number: "",
        planned_loading_time: new Date().toISOString(),
        driver_comment: "",
        message_id: 0,
        points: [createEmptyPoint()],
      }
      assignment.trips = [...assignment.trips, newTrip]
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }

  const removeTripFromDriver = (assignmentIndex: number, tripIndex: number) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      const tripIdentifier =
        assignment.trips[tripIndex].original_trip_identifier || assignment.trips[tripIndex].trip_identifier

      assignment.trips = assignment.trips.filter((_, i) => i !== tripIndex)
      if (tripIdentifier) {
        assignment.deletedTrips = [...assignment.deletedTrips, tripIdentifier]
      }
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }

  const addNewDriverAssignment = () => {
    setDriverAssignments((prevAssignments) => [...prevAssignments, createEmptyDriverAssignment()])
  }

  const removeDriverAssignment = (assignmentIndex: number) => {
    setDriverAssignments((prevAssignments) => prevAssignments.filter((_, i) => i !== assignmentIndex))
  }

  // Driver selection for each assignment block
  const handleDriverSelect = useCallback((assignmentIndex: number, selectedDriver: Driver) => {
    setDriverAssignments((prevAssignments) => {
      const updatedAssignments = [...prevAssignments]
      const assignment = { ...updatedAssignments[assignmentIndex] }
      assignment.driver = selectedDriver
      // Update phone for all trips in this assignment
      assignment.trips = assignment.trips.map((trip) => ({
        ...trip,
        phone: selectedDriver.phone,
      }))
      updatedAssignments[assignmentIndex] = assignment
      return updatedAssignments
    })
  }, [])

  const handleDriverSearchStateChange = useCallback(
    (assignmentIndex: number, state: { open?: boolean; search?: string }) => {
      setDriverAssignments((prevAssignments) => {
        const updatedAssignments = [...prevAssignments]
        const assignment = { ...updatedAssignments[assignmentIndex] }
        if (typeof state.open !== "undefined") {
          assignment.driverSearchOpen = state.open
        }
        if (typeof state.search !== "undefined") {
          assignment.driverSearchValue = state.search
        }
        updatedAssignments[assignmentIndex] = assignment
        return updatedAssignments
      })
    },
    [],
  )

  // Save and Send logic
  const saveCorrections = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    if (mode === "edit") {
      // Existing edit mode logic (single assignment)
      const currentAssignment = driverAssignments[0] // Assuming only one for edit mode
      const flatCorrections = currentAssignment.trips.flatMap((trip) =>
        trip.points.map((point) => ({
          phone: trip.phone,
          driver_phone: currentAssignment.driver?.phone || "",
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

      try {
        const response = await fetch(`/api/trips/${tripId}/save-corrections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: currentAssignment.driver?.phone,
            driver_phone: currentAssignment.driver?.phone,
            corrections: flatCorrections,
            deletedTrips: currentAssignment.deletedTrips,
          }),
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
        console.error("❌ Save error (edit mode):", error)
        setError("Ошибка при сохранении данных")
        return { success: false }
      } finally {
        setIsSaving(false)
      }
    } else {
      // New create mode logic (multiple assignments)
      const allResults: { success: boolean; conflict?: boolean; data?: any; error?: string; conflict_data?: any[] }[] =
        []
      let hasConflict = false
      let overallSuccess = true
      const aggregatedConflicts: any[] = []

      for (const assignment of driverAssignments) {
        if (!assignment.driver?.phone) {
          overallSuccess = false
          setError("Для всех новых рейсов должен быть выбран водитель.")
          break
        }
        if (assignment.trips.length === 0) {
          overallSuccess = false
          setError("Добавьте хотя бы один рейс для каждого водителя.")
          break
        }

        const tripDataForSendMessages = assignment.trips.map((trip) => ({
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

        try {
          const response = await fetch("/api/send-messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripData: tripDataForSendMessages }),
          })

          const data = await response.json()
          allResults.push({
            success: data.success,
            data: data,
            error: data.error,
            conflict: data.error === "trip_already_assigned",
            conflict_data: data.conflict_data,
          })

          if (!data.success) {
            overallSuccess = false
            if (data.error === "trip_already_assigned") {
              hasConflict = true
              aggregatedConflicts.push(...(data.conflict_data || []))
            } else {
              setError(data.error || "Ошибка при создании рейсов")
            }
          }
        } catch (error) {
          overallSuccess = false
          console.error("❌ Save error (create mode, per assignment):", error)
          setError("Ошибка при создании рейсов")
          allResults.push({ success: false, error: "Network error" })
        }
      }

      setIsSaving(false)

      if (hasConflict) {
        setConflictedTrips(aggregatedConflicts)
        setError(`Конфликт рейсов: ${aggregatedConflicts.map((c) => c.trip_identifier).join(", ")}`)
        return { success: false, conflict: true, allResults }
      } else if (!overallSuccess) {
        return { success: false, allResults }
      } else {
        return { success: true, allResults }
      }
    }
  }

  const sendData = async () => {
    setIsSending(true)
    setError(null)
    setSuccess(null)
    setConflictedTrips([])

    try {
      const { success, data, conflict, allResults } = await saveCorrections()

      if (!success) {
        if (conflict) return // Conflicts handled by saveCorrections, just return
        throw new Error(error || "Не удалось сохранить данные") // Use existing error or generic
      }

      if (mode === "edit") {
        const currentAssignment = driverAssignments[0]
        const messageIds = [...new Set(currentAssignment.trips.map((c) => c.message_id))]
        const resendResponse = await fetch(`/api/trips/messages/${messageIds[0]}/resend-combined`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: currentAssignment.driver?.phone,
            driver_phone: currentAssignment.driver?.phone,
            messageIds,
            isCorrection: true,
            deletedTrips: currentAssignment.deletedTrips,
          }),
        })

        const resendData = await resendResponse.json()
        if (resendData.success) {
          setSuccess("Корректировка отправлена водителю!")
          if (onCorrectionSent) {
            onCorrectionSent(currentAssignment.trips, currentAssignment.deletedTrips)
          }
        } else {
          setError(resendData.error || "Ошибка при отправке корректировки")
        }
      } else {
        // For create mode, data contains allResults from saveCorrections
        setSuccess("Рассылка создана успешно!")
        if (onAssignmentSent) {
          onAssignmentSent(allResults)
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

  const handlePointSearchStateChange = useCallback((key: string, state: { open?: boolean; search?: string }) => {
    setPointSearchStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...state },
    }))
  }, [])

  // Load drivers for create mode
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
            {driverAssignments.map((assignment, assignmentIndex) => (
              <div key={assignment.id} className="border rounded-lg p-4 bg-blue-50 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-blue-900">
                      {mode === "edit" ? "Водитель" : `Водитель ${assignmentIndex + 1}`}
                    </h3>
                  </div>
                  {mode === "create" && driverAssignments.length > 1 && (
                    <Button variant="destructive" size="sm" onClick={() => removeDriverAssignment(assignmentIndex)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Удалить водителя
                    </Button>
                  )}
                </div>

                {mode === "create" && (
                  <Popover
                    open={assignment.driverSearchOpen}
                    onOpenChange={(open) => handleDriverSearchStateChange(assignmentIndex, { open })}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assignment.driverSearchOpen}
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
                          value={assignment.driverSearchValue}
                          onValueChange={(value) => handleDriverSearchStateChange(assignmentIndex, { search: value })}
                        />
                        <CommandList>
                          <CommandEmpty>Водители не найдены</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            {driversList
                              .filter((driver) => {
                                const search = assignment.driverSearchValue.toLowerCase()
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
                                    handleDriverSelect(assignmentIndex, driver)
                                    handleDriverSearchStateChange(assignmentIndex, { open: false, search: "" }) // Clear search on select
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
                )}

                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => addNewTripToDriver(assignmentIndex)}
                    variant="outline"
                    className="text-green-600 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить новый рейс для этого водителя
                  </Button>
                </div>

                {assignment.trips.map((trip, tripIndex) => (
                  <TripRow
                    key={trip.original_trip_identifier || `trip-${assignment.id}-${tripIndex}`}
                    trip={trip}
                    tripIndex={tripIndex}
                    availablePoints={availablePoints}
                    pointSearchStates={pointSearchStates}
                    handleSearchStateChange={handlePointSearchStateChange}
                    updateTrip={(field, value) => updateTrip(assignmentIndex, tripIndex, field, value)}
                    movePointUp={(pointIdx) => movePointUp(assignmentIndex, tripIndex, pointIdx)}
                    movePointDown={(pointIdx) => movePointDown(assignmentIndex, tripIndex, pointIdx)}
                    updatePoint={(pointIdx, field, value) =>
                      updatePoint(assignmentIndex, tripIndex, pointIdx, field, value)
                    }
                    addNewPoint={() => addNewPoint(assignmentIndex, tripIndex)}
                    removePoint={(pointIdx) => removePoint(assignmentIndex, tripIndex, pointIdx)}
                    removeTrip={() => removeTripFromDriver(assignmentIndex, tripIndex)}
                    correctionsLength={assignment.trips.length}
                    formatDateTime={formatDateTime}
                    formatDateTimeForSave={formatDateTimeForSave}
                  />
                ))}
              </div>
            ))}

            {mode === "create" && (
              <div className="flex justify-center mt-6">
                <Button onClick={addNewDriverAssignment} variant="secondary">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить нового водителя и рейсы
                </Button>
              </div>
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
                  driverAssignments.some((a) => !a.driver?.phone || a.trips.length === 0)
                }
                title={
                  conflictedTrips.length > 0
                    ? "Сначала разрешите конфликты рейсов"
                    : driverAssignments.some((a) => !a.driver?.phone)
                      ? "Выберите водителя для всех новых рейсов"
                      : driverAssignments.some((a) => a.trips.length === 0)
                        ? "Добавьте хотя бы один рейс для каждого водителя"
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
