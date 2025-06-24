"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, RefreshCw, Send, Clock, User, Phone, Filter, X } from "lucide-react"

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
}

interface GroupedDriver {
  phone: string
  telegram_id?: number
  first_name?: string
  full_name?: string
  trips: TripMessage[]
  overall_status: string
  overall_response_status: string
  sent_at?: string
  response_at?: string
  response_comment?: string
}

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tripId = Number.parseInt(params.id as string)
  const filterParam = searchParams.get("filter")

  const [messages, setMessages] = useState<TripMessage[]>([])
  const [groupedDrivers, setGroupedDrivers] = useState<GroupedDriver[]>([])
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resendingPhone, setResendingPhone] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(filterParam)

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/messages`)
      const data = await response.json()
      if (data.success) {
        setMessages(data.messages)

        // Группируем сообщения по водителям
        const grouped = groupMessagesByDriver(data.messages)
        setGroupedDrivers(grouped)
      }
    } catch (error) {
      console.error("Error fetching trip messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

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
        })
      }

      const driver = driverMap.get(message.phone)!
      driver.trips.push(message)
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

  // Генерация маршрута для конкретного рейса
  const generateRouteForTrip = (tripIdentifier: string) => {
    const tripPoints = messages
      .filter((m) => m.trip_identifier === tripIdentifier)
      .map((m) => ({ trip_identifier: m.trip_identifier }))

    if (tripPoints.length === 0) {
      return "Нет данных о маршруте"
    }

    // Здесь нужно получить пункты для конкретного trip_identifier
    // Пока возвращаем заглушку
    return `Маршрут для ${tripIdentifier}`
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

  const handleResendForDriver = async (phone: string) => {
    setResendingPhone(phone)
    try {
      // Отправляем запрос на повторную отправку для всех сообщений водителя
      const driverMessages = messages.filter((m) => m.phone === phone)

      for (const message of driverMessages) {
        const response = await fetch(`/api/trips/messages/${message.id}/resend-telegram`, {
          method: "POST",
        })
        const data = await response.json()
        if (!data.success) {
          throw new Error(`Failed to resend message ${message.id}`)
        }
      }

      await fetchMessages()
    } catch (error) {
      console.error("Error resending messages:", error)
    } finally {
      setResendingPhone(null)
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

  // Применяем фильтры
  const filteredDrivers = groupedDrivers.filter((driver) => {
    if (!activeFilter) return true

    switch (activeFilter) {
      case "pending":
        return driver.overall_response_status === "pending"
      case "confirmed":
        return driver.overall_response_status === "confirmed"
      case "rejected":
        return driver.overall_response_status === "rejected"
      case "error":
        return driver.overall_status === "error"
      default:
        return true
    }
  })

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

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Загрузка сообщений...
        </div>
      ) : filteredDrivers.length === 0 ? (
        <Alert>
          <AlertDescription>
            {activeFilter ? "Сообщения с выбранными фильтрами не найдены." : "Сообщения для этой рассылки не найдены."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Сообщения рассылки (сгруппированы по водителям)</CardTitle>
            <CardDescription>
              {activeFilter
                ? `Отфильтрованные водители: ${filteredDrivers.length} из ${groupedDrivers.length}`
                : "Список всех водителей и их рейсов"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Водитель</TableHead>
                  <TableHead>Рейсы</TableHead>
                  <TableHead>Статус отправки</TableHead>
                  <TableHead>Ответ водителя</TableHead>
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
                      <div className="space-y-2">
                        {driver.trips.map((trip, index) => (
                          <div key={trip.id} className="text-sm border rounded p-2">
                            <div className="font-medium">
                              Рейс {index + 1}: {trip.trip_identifier}
                            </div>
                            <div>🚗 {trip.vehicle_number}</div>
                            <div>⏰ {formatDateTime(trip.planned_loading_time || "")}</div>
                            {trip.driver_comment && (
                              <div className="text-muted-foreground">💬 {trip.driver_comment}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(driver.overall_status, driver.overall_response_status)}
                        {driver.sent_at && (
                          <span
                            className={`text-xs ${
                              driver.overall_response_status === "confirmed" ? "text-gray-400" : "text-muted-foreground"
                            }`}
                          >
                            <Clock className="h-3 w-3 inline mr-1" />
                            {getTimeSinceSent(driver.sent_at)} назад
                          </span>
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
    </div>
  )
}
