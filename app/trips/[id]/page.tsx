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
} from "lucide-react"

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

interface TripRow {
  messageId: number
  phone: string
  telegram_id?: number
  first_name?: string
  full_name?: string
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

type SortField =
  | "driver"
  | "trip_identifier"
  | "vehicle_number"
  | "planned_loading_time"
  | "route"
  | "driver_comment"
  | "status"
  | "response_status"
type SortDirection = "asc" | "desc" | null

interface ColumnFilters {
  driver: string
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
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
  const [tripRows, setTripRows] = useState<TripRow[]>([])
  const [filteredRows, setFilteredRows] = useState<TripRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resendingTrip, setResendingTrip] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(filterParam)

  // Состояние для сортировки
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Состояние для фильтров колонок
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    driver: "",
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: "",
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

  // Преобразование сообщений в строки таблицы
  useEffect(() => {
    const rows: TripRow[] = messages.map((message) => ({
      messageId: message.id,
      phone: message.phone,
      telegram_id: message.telegram_id,
      first_name: message.first_name,
      full_name: message.full_name,
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
    }))

    setTripRows(rows)
  }, [messages, tripPoints])

  // Получение уникальных значений для фильтров
  const getUniqueValues = (field: keyof TripRow | "driver") => {
    if (field === "driver") {
      return tripRows
        .map((row) => row.full_name || row.first_name || "Неизвестный")
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort()
    }

    const values = tripRows
      .map((row) => {
        if (field === "status") {
          return getStatusText(row.status)
        }
        if (field === "response_status") {
          return getResponseText(row.response_status)
        }
        return row[field] as string
      })
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort()

    return values
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
    let filtered = tripRows

    // Применяем основной фильтр (из URL)
    if (activeFilter === "pending") {
      filtered = filtered.filter((row) => row.response_status === "pending")
    } else if (activeFilter === "confirmed") {
      filtered = filtered.filter((row) => row.response_status === "confirmed")
    } else if (activeFilter === "rejected") {
      filtered = filtered.filter((row) => row.response_status === "rejected")
    } else if (activeFilter === "error") {
      filtered = filtered.filter((row) => row.status === "error")
    }

    // Применяем фильтры колонок
    Object.entries(columnFilters).forEach(([field, value]) => {
      if (value) {
        filtered = filtered.filter((row) => {
          if (field === "driver") {
            const driverName = row.full_name || row.first_name || "Неизвестный"
            return driverName.toLowerCase().includes(value.toLowerCase())
          }
          if (field === "status") {
            return getStatusText(row.status).includes(value)
          }
          if (field === "response_status") {
            return getResponseText(row.response_status).includes(value)
          }
          const rowValue = row[field as keyof TripRow]
          return rowValue && rowValue.toString().toLowerCase().includes(value.toLowerCase())
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
        } else if (sortField === "status") {
          aValue = getStatusText(a.status)
          bValue = getStatusText(b.status)
        } else if (sortField === "response_status") {
          aValue = getResponseText(a.response_status)
          bValue = getResponseText(b.response_status)
        } else if (sortField === "planned_loading_time") {
          aValue = new Date(a[sortField] || 0)
          bValue = new Date(b[sortField] || 0)
        } else {
          aValue = a[sortField] || ""
          bValue = b[sortField] || ""
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    setFilteredRows(filtered)
  }, [tripRows, activeFilter, columnFilters, sortField, sortDirection])

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
      planned_loading_time: "",
      route: "",
      driver_comment: "",
      status: "",
      response_status: "",
    })
    setSortField(null)
    setSortDirection(null)
  }

  const hasActiveFilters = Object.values(columnFilters).some((value) => value !== "") || sortField !== null

  const handleResendForTrip = async (phone: string, tripIdentifier: string) => {
    setResendingTrip(`${phone}-${tripIdentifier}`)
    try {
      // Находим все сообщения для этого водителя
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
      setResendingTrip(null)
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
      </div>

      {/* Основной фильтр */}
      {activeFilter && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Фильтр: {getFilterLabel(activeFilter)}</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {filteredRows.length} из {tripRows.length}
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
                {filteredRows.length} записей
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
      ) : filteredRows.length === 0 ? (
        <Alert>
          <AlertDescription>
            {activeFilter || hasActiveFilters
              ? "Сообщения с выбранными фильтрами не найдены."
              : "Сообщения для этой рассылки не найдены."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Сообщения рассылки (по рейсам)</CardTitle>
            <CardDescription>
              {activeFilter || hasActiveFilters
                ? `Отфильтрованные рейсы: ${filteredRows.length} из ${tripRows.length}`
                : "Список всех рейсов с детальной информацией"}
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
                          onClick={() => handleSort("trip_identifier")}
                          className="h-auto p-0 font-medium"
                        >
                          Рейс {getSortIcon("trip_identifier")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="trip_identifier"
                        value={columnFilters.trip_identifier}
                        onValueChange={(value) => handleColumnFilter("trip_identifier", value)}
                        options={getUniqueValues("trip_identifier")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("vehicle_number")}
                          className="h-auto p-0 font-medium"
                        >
                          Транспорт {getSortIcon("vehicle_number")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="vehicle_number"
                        value={columnFilters.vehicle_number}
                        onValueChange={(value) => handleColumnFilter("vehicle_number", value)}
                        options={getUniqueValues("vehicle_number")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("planned_loading_time")}
                          className="h-auto p-0 font-medium"
                        >
                          Время погрузки {getSortIcon("planned_loading_time")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="planned_loading_time"
                        value={columnFilters.planned_loading_time}
                        onValueChange={(value) => handleColumnFilter("planned_loading_time", value)}
                        options={getUniqueValues("planned_loading_time")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("route")}
                          className="h-auto p-0 font-medium"
                        >
                          Маршрут {getSortIcon("route")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="route"
                        value={columnFilters.route}
                        onValueChange={(value) => handleColumnFilter("route", value)}
                        options={getUniqueValues("route")}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("driver_comment")}
                          className="h-auto p-0 font-medium"
                        >
                          Комментарий {getSortIcon("driver_comment")}
                        </Button>
                      </div>
                      <FilterableSelect
                        field="driver_comment"
                        value={columnFilters.driver_comment}
                        onValueChange={(value) => handleColumnFilter("driver_comment", value)}
                        options={getUniqueValues("driver_comment")}
                      />
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
                {filteredRows.map((row) => (
                  <TableRow key={row.messageId}>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{row.full_name || row.first_name || "Неизвестный"}</div>
                            {row.telegram_id && (
                              <div className="text-xs text-muted-foreground">ID: {row.telegram_id}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={row.response_status === "confirmed" ? undefined : () => handleSkypeCall(row.phone)}
                          disabled={row.response_status === "confirmed"}
                          className={
                            row.response_status === "confirmed"
                              ? "w-full bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed hover:bg-gray-100"
                              : "w-full bg-green-600 hover:bg-green-700 text-white"
                          }
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {formatPhone(row.phone)}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{row.trip_identifier || "—"}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium">{row.vehicle_number || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm whitespace-nowrap">{formatDateTime(row.planned_loading_time)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{row.route}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{row.driver_comment || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(row.status, row.response_status)}
                        {row.sent_at && (
                          <span
                            className={`text-xs ${
                              row.response_status === "confirmed" ? "text-gray-400" : "text-muted-foreground"
                            }`}
                          >
                            <Clock className="h-3 w-3 inline mr-1" />
                            {getTimeSinceSent(row.sent_at)} назад
                          </span>
                        )}
                        {row.error_message && <span className="text-xs text-red-600">{row.error_message}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getResponseBadge(row.response_status)}
                        {row.response_at && (
                          <span
                            className={`text-xs ${
                              row.response_status === "confirmed" ? "text-gray-400" : "text-muted-foreground"
                            }`}
                          >
                            {formatDate(row.response_at)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.response_comment ? (
                        <div className="max-w-xs">
                          <span className="text-sm">{row.response_comment}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {row.response_status === "confirmed" ? (
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
                            onClick={() => handleResendForTrip(row.phone, row.trip_identifier)}
                            disabled={resendingTrip === `${row.phone}-${row.trip_identifier}`}
                            variant="default"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {resendingTrip === `${row.phone}-${row.trip_identifier}` ? (
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
    </div>
  )
}
