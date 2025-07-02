"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  RefreshCw,
  Send,
  Clock,
  User,
  Phone,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
} from "lucide-react"
import { TripCorrectionModal } from "@/components/trip-correction-modal"

interface TripMessage {
  id: number
  phone: string
  message: string
  telegram_id?: number
  status: string
  error_message?: string
  sent_at?: string
  response_status: string
  response_comment?: string
  response_at?: string
  first_name?: string
  full_name?: string
  created_at: string
  trip_identifier?: string
  vehicle_number?: string
  planned_loading_time?: string
  driver_comment?: string
  trip_id?: number
}

interface TripPoint {
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name: string
  point_short_id: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  trip_identifier?: string
}

interface TripData {
  messageId: number
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  route: string
  status: string
  response_status: string
  response_comment?: string
  sent_at?: string
  response_at?: string
  error_message?: string
}

interface GroupedDriver {
  phone: string
  telegram_id?: number
  first_name?: string
  full_name?: string
  trips: TripData[]
  overall_status: string
  overall_response_status: string
  sent_at?: string
  response_at?: string
  response_comment?: string
  messageIds: number[]
}

type SortField = "driver" | "trips_count" | "status" | "response_status"
type SortDirection = "asc" | "desc" | null

interface ColumnFilters {
  driver: string
  trip_identifier: string
  vehicle_number: string
  route: string
  driver_comment: string
  status: string
  response_status: string
}

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tripId = Number.parseInt(params.id as string)
  const filterParam = searchParams.get("filter")

  const [messages, setMessages] = useState<TripMessage[]>([])
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([])
  const [groupedDrivers, setGroupedDrivers] = useState<GroupedDriver[]>([])
  const [filteredDrivers, setFilteredDrivers] = useState<GroupedDriver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resendingPhone, setResendingPhone] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [correctionModal, setCorrectionModal] = useState<{
    isOpen: boolean
    phone: string
    driverName: string
  } | null>(null)

  // Проверяем можно ли удалить рассылку (все подтверждены или завершены)
  const canDeleteTrip = () => {
    return (
      groupedDrivers.every(
        (driver) => driver.overall_response_status === "confirmed" || driver.overall_status === "error",
      ) && groupedDrivers.length > 0
    )
  }
  const [activeFilter, setActiveFilter] = useState<string | null>(filterParam)

  // Состояние для сортировки
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Состояние для фильтров колонок
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    driver: "",
    trip_identifier: "",
    vehicle_number: "",
    route: "",
    driver_comment: "",
    status: "",
    response_status: "",
  })

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/messages`)
      const data = await response.json()
      if (data.success) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error("Error fetching trip messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTripPoints = async () => {
    try {
      console.log(`Fetching points for trip ${tripId}`)
      const response = await fetch(`/api/trips/${tripId}/points`)
      const data = await response.json()
      console.log("Trip points response:", data)
      if (data.success) {
        setTripPoints(data.points)
        console.log("Trip points set:", data.points)
      }
    } catch (error) {
      console.error("Error fetching trip points:", error)
    }
  }

  useEffect(() => {
    fetchMessages()
    fetchTripPoints()
  }, [tripId])

  // Построение маршрута для конкретного рейса
  const buildRouteForTrip = (tripIdentifier: string): string => {
    const points = tripPoints.filter((point) => point.trip_identifier === tripIdentifier)

    if (points.length === 0) {
      return "Нет данных"
    }

    // Сортируем: сначала P (погрузка) по point_num, потом D (разгрузка) по point_num
    const sortedPoints = points.sort((a, b) => {
      if (a.point_type !== b.point_type) {
        return a.point_type === "P" ? -1 : 1
      }
      return a.point_num - b.point_num
    })

    // Собираем маршрут из point_short_id (это point_id из таблицы points)
    const route = sortedPoints.map((point) => point.point_short_id || point.point_id).join("-")

    console.log(`Route for trip ${tripIdentifier}:`, route, sortedPoints)
    return route
  }

  // Группировка сообщений по водителям
  const groupMessagesByDriver = (messages: TripMessage[]): GroupedDriver[] => {
    const driverMap = new Map<string, GroupedDriver>()

    messages.forEach((message) => {
      if (!driverMap.has(message.phone)) {
        driverMap.set(message.phone, {
          phone: message.phone,
          telegram_id: message.telegram_id,
          first_name: message.first_name,
          full_name: message.full_name,
          trips: [],
          overall_status: "pending",
          overall_response_status: "pending",
          messageIds: [],
        })
      }

      const driver = driverMap.get(message.phone)!
      driver.messageIds.push(message.id)

      const tripData: TripData = {
        messageId: message.id,
        trip_identifier: message.trip_identifier || "",
        vehicle_number: message.vehicle_number || "",
        planned_loading_time: message.planned_loading_time || "",
        driver_comment: message.driver_comment || "",
        route: buildRouteForTrip(message.trip_identifier || ""),
        status: message.status,
        response_status: message.response_status,
        response_comment: message.response_comment,
        sent_at: message.sent_at,
        response_at: message.response_at,
        error_message: message.error_message,
      }

      driver.trips.push(tripData)
    })

    // Определяем общий статус для каждого водителя
    driverMap.forEach((driver) => {
      // Общий статус отправки
      const statuses = driver.trips.map((t) => t.status)
      if (statuses.every((s) => s === "sent")) {
        driver.overall_status = "sent"
        driver.sent_at = driver.trips.find((t) => t.sent_at)?.sent_at
      } else if (statuses.some((s) => s === "error")) {
        driver.overall_status = "error"
      } else {
        driver.overall_status = "pending"
      }

      // Общий статус ответа
      const responseStatuses = driver.trips.map((t) => t.response_status)
      if (responseStatuses.every((s) => s === "confirmed")) {
        driver.overall_response_status = "confirmed"
        driver.response_at = driver.trips.find((t) => t.response_at)?.response_at
      } else if (responseStatuses.some((s) => s === "rejected")) {
        driver.overall_response_status = "rejected"
        driver.response_at = driver.trips.find((t) => t.response_at)?.response_at
        driver.response_comment = driver.trips.find((t) => t.response_comment)?.response_comment
      } else {
        driver.overall_response_status = "pending"
      }
    })

    return Array.from(driverMap.values())
  }

  // Преобразование сообщений в сгруппированных водителей
  useEffect(() => {
    const grouped = groupMessagesByDriver(messages)
    setGroupedDrivers(grouped)
  }, [messages, tripPoints])

  // Получение уникальных значений для фильтров
  const getUniqueValues = (field: keyof ColumnFilters | "driver") => {
    if (field === "driver") {
      return groupedDrivers
        .map((driver) => driver.full_name || driver.first_name || "Неизвестный")
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort()
    }

    const values: string[] = []
    groupedDrivers.forEach((driver) => {
      driver.trips.forEach((trip) => {
        if (field === "status") {
          values.push(getStatusText(trip.status))
        } else if (field === "response_status") {
          values.push(getResponseText(trip.response_status))
        } else if (field === "trip_identifier") {
          values.push(trip.trip_identifier)
        } else if (field === "vehicle_number") {
          values.push(trip.vehicle_number)
        } else if (field === "route") {
          values.push(trip.route)
        } else if (field === "driver_comment") {
          values.push(trip.driver_comment)
        }
      })
    })

    return values
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort()
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "sent":
        return "Отправлено"
      case "error":
        return "Ошибка"
      case "pending":
        return "Ожидает"
      default:
        return status
    }
  }

  const getResponseText = (responseStatus: string) => {
    switch (responseStatus) {
      case "confirmed":
        return "Подтверждено"
      case "rejected":
        return "Отклонено"
      case "pending":
        return "Ожидает ответа"
      default:
        return responseStatus
    }
  }

  // Применение фильтров и сортировки
  useEffect(() => {
    let filtered = groupedDrivers

    // Применяем основной фильтр (из URL)
    if (activeFilter === "pending") {
      filtered = filtered.filter((driver) => driver.overall_response_status === "pending")
    } else if (activeFilter === "confirmed") {
      filtered = filtered.filter((driver) => driver.overall_response_status === "confirmed")
    } else if (activeFilter === "rejected") {
      filtered = filtered.filter((driver) => driver.overall_response_status === "rejected")
    } else if (activeFilter === "error") {
      filtered = filtered.filter((driver) => driver.overall_status === "error")
    }

    // Применяем фильтры колонок
    Object.entries(columnFilters).forEach(([field, value]) => {
      if (value) {
        filtered = filtered.filter((driver) => {
          if (field === "driver") {
            const driverName = driver.full_name || driver.first_name || "Неизвестный"
            return driverName.toLowerCase().includes(value.toLowerCase())
          }
          if (field === "status") {
            return getStatusText(driver.overall_status).includes(value)
          }
          if (field === "response_status") {
            return getResponseText(driver.overall_response_status).includes(value)
          }

          // Для остальных полей ищем в рейсах водителя
          return driver.trips.some((trip) => {
            if (field === "trip_identifier") {
              return trip.trip_identifier.toLowerCase().includes(value.toLowerCase())
            }
            if (field === "vehicle_number") {
              return trip.vehicle_number.toLowerCase().includes(value.toLowerCase())
            }
            if (field === "route") {
              return trip.route.toLowerCase().includes(value.toLowerCase())
            }
            if (field === "driver_comment") {
              return trip.driver_comment.toLowerCase().includes(value.toLowerCase())
            }
            return false
          })
        })
      }
    })

    // Применяем сортировку
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        if (sortField === "driver") {
          aValue = a.full_name || a.first_name || "Неизвестный"
          bValue = b.full_name || b.first_name || "Неизвестный"
        } else if (sortField === "trips_count") {
          aValue = a.trips.length
          bValue = b.trips.length
        } else if (sortField === "status") {
          aValue = getStatusText(a.overall_status)
          bValue = getStatusText(b.overall_status)
        } else if (sortField === "response_status") {
          aValue = getResponseText(a.overall_response_status)
          bValue = getResponseText(b.overall_response_status)
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    setFilteredDrivers(filtered)
  }, [groupedDrivers, activeFilter, columnFilters, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4" />
    if (sortDirection === "desc") return <ArrowDown className="h-4 w-4" />
    return <ArrowUpDown className="h-4 w-4" />
  }

  const handleColumnFilter = (field: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [field]: value === "all" ? "" : value,
    }))
  }

  const clearAllFilters = () => {
    setColumnFilters({
      driver: "",
      trip_identifier: "",
      vehicle_number: "",
      route: "",
      driver_comment: "",
      status: "",
      response_status: "",
    })
    setSortField(null)
    setSortDirection(null)
  }

  const hasActiveFilters = Object.values(columnFilters).some((value) => value !== "") || sortField !== null

  const handleResendForDriver = async (phone: string) => {
    setResendingPhone(phone)
    try {
      // Получаем все рейсы водителя
      const driverMessages = messages.filter((m) => m.phone === phone)

      if (driverMessages.length === 0) {
        throw new Error("No messages found for driver")
      }

      // Отправляем запрос на повторную отправку объединенного сообщения
      const response = await fetch(`/api/trips/messages/${driverMessages[0].id}/resend-combined`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          messageIds: driverMessages.map((m) => m.id),
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to resend combined message")
      }

      await fetchMessages()
    } catch (error) {
      console.error("Error resending messages:", error)
    } finally {
      setResendingPhone(null)
    }
  }

  const handleDeleteTrip = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to delete trip")
      }

      // Перенаправляем на список рассылок
      router.push("/trips")
    } catch (error) {
      console.error("Error deleting trip:", error)
      alert("Ошибка при удалении рассылки")
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "—"

    try {
      const date = new Date(dateString)
      return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return dateString
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`
    }
    return phone
  }

  const getTimeSinceSent = (sentAt: string) => {
    const now = new Date()
    const sent = new Date(sentAt)
    const diffMs = now.getTime() - sent.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}ч ${diffMinutes}м`
    } else {
      return `${diffMinutes}м`
    }
  }

  const getStatusBadge = (status: string, responseStatus?: string) => {
    if (responseStatus === "confirmed") {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200">
          Отправлено
        </Badge>
      )
    }

    switch (status) {
      case "sent":
        return (
          <Badge variant="default" className="bg-green-600">
            Отправлено
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Ошибка</Badge>
      case "pending":
        return <Badge variant="secondary">Ожидает</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getResponseBadge = (responseStatus: string) => {
    switch (responseStatus) {
      case "confirmed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-600 border-green-200">
            Подтверждено
          </Badge>
        )
      case "rejected":
        return <Badge variant="destructive">Отклонено</Badge>
      case "pending":
        return <Badge variant="secondary">Ожидает ответа</Badge>
      default:
        return <Badge variant="outline">{responseStatus}</Badge>
    }
  }

  const handleSkypeCall = (phone: string) => {
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`
    window.location.href = `tel:${formattedPhone}`
  }

  const clearFilter = () => {
    setActiveFilter(null)
    router.push(`/trips/${tripId}`)
  }

  const getFilterLabel = (filter: string | null) => {
    switch (filter) {
      case "pending":
        return "Ожидающие ответа"
      case "confirmed":
        return "Подтвержденные"
      case "rejected":
        return "Отклоненные"
      case "error":
        return "С ошибками"
      default:
        return "Все сообщения"
    }
  }

  const FilterableSelect = ({
    field,
    value,
    onValueChange,
    options,
    placeholder = "Все",
  }: {
    field: string
    value: string
    onValueChange: (value: string) => void
    options: string[]
    placeholder?: string
  }) => {
    return (
      <Select value={value || "all"} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Исправленная функция форматирования времени для ISO формата
  const formatTimeRussian = (dateString: string) => {
    if (!dateString) return "—"

    try {
      // Парсим ISO формат "2025-06-20T15:00:00.000Z"
      if (dateString.includes("T") && (dateString.includes("Z") || dateString.includes("+"))) {
        // Это ISO формат - парсим как UTC и НЕ конвертируем в локальное время
        const isoMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
        if (isoMatch) {
          const [, year, month, day, hour, minute] = isoMatch

          const monthNames = [
            "января",
            "февраля",
            "марта",
            "апреля",
            "мая",
            "июня",
            "июля",
            "августа",
            "сентября",
            "октября",
            "ноября",
            "декабря",
          ]

          const monthName = monthNames[Number.parseInt(month) - 1]
          return `${Number.parseInt(day)} ${monthName} ${year}, ${hour}:${minute}`
        }
      }

      // Парсим формат "6/20/25 15:00" или "M/D/YY H:MM"
      const parts = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/)
      if (parts) {
        const [, month, day, year, hour, minute] = parts

        // Преобразуем год в полный формат
        const fullYear = year.length === 2 ? `20${year}` : year

        const monthNames = [
          "января",
          "февраля",
          "марта",
          "апреля",
          "мая",
          "июня",
          "июля",
          "августа",
          "сентября",
          "октября",
          "ноября",
          "декабря",
        ]

        const monthName = monthNames[Number.parseInt(month) - 1]
        return `${Number.parseInt(day)} ${monthName} ${fullYear}, ${hour.padStart(2, "0")}:${minute}`
      }

      // Если формат не M/D/YY H:MM, пробуем DD.MM.YYYY HH:MM
      const parts2 = dateString.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/)
      if (parts2) {
        const [, day, month, year, hour, minute] = parts2
        const monthNames = [
          "января",
          "февраля",
          "марта",
          "апреля",
          "мая",
          "июня",
          "июля",
          "августа",
          "сентября",
          "октября",
          "ноября",
          "декабря",
        ]
        const monthName = monthNames[Number.parseInt(month) - 1]
        return `${Number.parseInt(day)} ${monthName} ${year}, ${hour}:${minute}`
      }

      // Если ничего не подошло, возвращаем как есть
      return dateString
    } catch (error) {
      console.error("Error formatting time:", error, "Input:", dateString)
      return dateString
    }
  }

  // Функция для расчета времени ответа
  const getResponseTime = (sentAt?: string, responseAt?: string) => {
    if (!sentAt) return null

    const sent = new Date(sentAt)
    const response = responseAt ? new Date(responseAt) : new Date()
    const diffMs = response.getTime() - sent.getTime()

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}ч ${diffMinutes}м`
    } else {
      return `${diffMinutes}м`
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Детали рассылки #{tripId}</h1>
          <p className="text-muted-foreground">Подробная информация о сообщениях и ответах</p>
        </div>
        <Button onClick={fetchMessages} disabled={isLoading} variant="outline" className="ml-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
        {canDeleteTrip() && (
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            variant="destructive"
            className="ml-2"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Удаление...
              </>
            ) : (
              "Удалить рассылку"
            )}
          </Button>
        )}
      </div>

      {/* Основной фильтр */}
      {activeFilter && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Фильтр: {getFilterLabel(activeFilter)}</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {filteredDrivers.length} из {groupedDrivers.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilter} className="text-blue-600 hover:text-blue-800">
              <X className="h-4 w-4 mr-1" />
              Сбросить
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Активные фильтры колонок */}
      {hasActiveFilters && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Активны фильтры и сортировка колонок</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {filteredDrivers.length} водителей
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-orange-600 hover:text-orange-800"
            >
              <X className="h-4 w-4 mr-1" />
              Очистить все
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Загрузка сообщений...
        </div>
      ) : filteredDrivers.length === 0 ? (
        <Alert>
          <AlertDescription>
            {activeFilter || hasActiveFilters
              ? "Водители с выбранными фильтрами не найдены."
              : "Водители для этой рассылки не найдены."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Сообщения рассылки (сгруппированы по водителям)</CardTitle>
            <CardDescription>
              {activeFilter || hasActiveFilters
                ? `Отфильтрованные водители: ${filteredDrivers.length} из ${groupedDrivers.length}`
                : "Список всех водителей с их рейсами"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("driver")}
                          className="h-auto p-0 font-medium"
                        >
                          Водитель {getSortIcon("driver")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="driver"
                        value={columnFilters.driver}
                        onValueChange={(value) => handleColumnFilter("driver", value)}
                        options={getUniqueValues("driver")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("trips_count")}
                          className="h-auto p-0 font-medium"
                        >
                          Рейсы {getSortIcon("trips_count")}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <FilterableSelect
                          field="trip_identifier"
                          value={columnFilters.trip_identifier}
                          onValueChange={(value) => handleColumnFilter("trip_identifier", value)}
                          options={getUniqueValues("trip_identifier")}
                          placeholder="Рейс"
                        />
                        <FilterableSelect
                          field="vehicle_number"
                          value={columnFilters.vehicle_number}
                          onValueChange={(value) => handleColumnFilter("vehicle_number", value)}
                          options={getUniqueValues("vehicle_number")}
                          placeholder="Транспорт"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <FilterableSelect
                          field="route"
                          value={columnFilters.route}
                          onValueChange={(value) => handleColumnFilter("route", value)}
                          options={getUniqueValues("route")}
                          placeholder="Маршрут"
                        />
                        <FilterableSelect
                          field="driver_comment"
                          value={columnFilters.driver_comment}
                          onValueChange={(value) => handleColumnFilter("driver_comment", value)}
                          options={getUniqueValues("driver_comment")}
                          placeholder="Комментарий"
                        />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("status")}
                          className="h-auto p-0 font-medium"
                        >
                          Статус {getSortIcon("status")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="status"
                        value={columnFilters.status}
                        onValueChange={(value) => handleColumnFilter("status", value)}
                        options={getUniqueValues("status")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("response_status")}
                          className="h-auto p-0 font-medium"
                        >
                          Ответ {getSortIcon("response_status")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="response_status"
                        value={columnFilters.response_status}
                        onValueChange={(value) => handleColumnFilter("response_status", value)}
                        options={getUniqueValues("response_status")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>Причина отклонения</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.phone}>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{driver.full_name || driver.first_name || "Неизвестный"}</div>
                            {driver.telegram_id && (
                              <div className="text-xs text-muted-foreground">ID: {driver.telegram_id}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={
                            driver.overall_response_status === "confirmed"
                              ? undefined
                              : () => handleSkypeCall(driver.phone)
                          }
                          disabled={driver.overall_response_status === "confirmed"}
                          className={
                            driver.overall_response_status === "confirmed"
                              ? "w-full bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed hover:bg-gray-100"
                              : "w-full bg-green-600 hover:bg-green-700 text-white"
                          }
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {formatPhone(driver.phone)}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        {driver.trips.map((trip, index) => (
                          <div key={trip.messageId} className="text-sm border rounded p-3 bg-gray-50">
                            <div className="font-medium text-blue-600 mb-2">
                              Рейс {index + 1}: {trip.trip_identifier}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">🚗</span>
                                <span className="font-medium">{trip.vehicle_number}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">⏰</span>
                                <span>{formatTimeRussian(trip.planned_loading_time)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">🛣️</span>
                                <span className="font-mono text-xs">{trip.route}</span>
                              </div>
                              {trip.driver_comment && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">💬</span>
                                  <span className="text-gray-700">{trip.driver_comment}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(driver.overall_status, driver.overall_response_status)}
                        {driver.sent_at && (
                          <div className="text-xs space-y-1">
                            <div
                              className={
                                driver.overall_response_status === "confirmed"
                                  ? "text-gray-400"
                                  : "text-muted-foreground"
                              }
                            >
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDate(driver.sent_at)}
                            </div>
                            <div
                              className={
                                driver.overall_response_status === "confirmed"
                                  ? "text-gray-400"
                                  : "text-muted-foreground"
                              }
                            >
                              ⏱️ {getResponseTime(driver.sent_at, driver.response_at)}
                              {driver.response_at ? " до ответа" : " ожидания"}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getResponseBadge(driver.overall_response_status)}
                        {driver.response_at && (
                          <span
                            className={`text-xs ${
                              driver.overall_response_status === "confirmed" ? "text-gray-400" : "text-muted-foreground"
                            }`}
                          >
                            {formatDate(driver.response_at)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {driver.response_comment ? (
                        <div className="max-w-xs">
                          <span className="text-sm">{driver.response_comment}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          onClick={() =>
                            setCorrectionModal({
                              isOpen: true,
                              phone: driver.phone,
                              driverName: driver.full_name || driver.first_name || "Неизвестный",
                            })
                          }
                          variant="outline"
                          size="sm"
                          className="mb-1 w-full"
                        >
                          <Edit className="h-3 w-3 mr-2" />
                          Корректировка
                        </Button>
                        {driver.overall_response_status === "confirmed" ? (
                          <Button
                            disabled
                            variant="outline"
                            size="sm"
                            className="bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          >
                            <Send className="h-3 w-3 mr-2" />
                            Повторно
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleResendForDriver(driver.phone)}
                            disabled={resendingPhone === driver.phone}
                            variant="default"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {resendingPhone === driver.phone ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                Отправка...
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3 mr-2" />
                                Повторная отправка
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Подтверждение удаления</h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить эту рассылку? Это действие нельзя отменить. Будут удалены все связанные
              данные из базы данных.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Отмена
              </Button>
              <Button variant="destructive" onClick={handleDeleteTrip} disabled={isDeleting}>
                {isDeleting ? "Удаление..." : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {correctionModal && (
        <TripCorrectionModal
          isOpen={correctionModal.isOpen}
          onClose={() => setCorrectionModal(null)}
          tripId={tripId}
          phone={correctionModal.phone}
          driverName={correctionModal.driverName}
          onCorrectionSent={() => {
            fetchMessages()
            setCorrectionModal(null)
          }}
        />
      )}
    </div>
  )
}
