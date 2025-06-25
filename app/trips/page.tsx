"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RefreshCw, Eye, Truck, Calendar, CheckCircle, XCircle, Clock, MoreVertical, Trash2 } from "lucide-react"

interface TripData {
  id: number
  created_at: string
  status: string
  total_messages: string | number
  sent_messages: string | number
  error_messages: string | number
  confirmed_responses: string | number
  rejected_responses: string | number
  pending_responses: string | number
  first_sent_at?: string
  last_sent_at?: string
  carpark?: string
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingTripId, setDeletingTripId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  const fetchTrips = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/trips")
      const data = await response.json()
      if (data.success) {
        setTrips(data.trips)
      }
    } catch (error) {
      console.error("Error fetching trips:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const calculateSentPercentage = (sent: string | number, total: string | number) => {
    const sentNum = Number(sent)
    const totalNum = Number(total)
    return totalNum > 0 ? Math.round((sentNum / totalNum) * 100) : 0
  }

  const calculateResponsePercentage = (
    confirmed: string | number,
    rejected: string | number,
    sent: string | number,
  ) => {
    const confirmedNum = Number(confirmed)
    const rejectedNum = Number(rejected)
    const sentNum = Number(sent)

    if (sentNum === 0) return 0
    const totalResponses = confirmedNum + rejectedNum
    const percentage = (totalResponses / sentNum) * 100

    console.log(
      `Response calculation: confirmed=${confirmedNum}, rejected=${rejectedNum}, sent=${sentNum}, totalResponses=${totalResponses}, percentage=${percentage}`,
    )

    // Ограничиваем максимальное значение 100%
    return Math.min(Math.round(percentage), 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage === 0) return "bg-gray-200"
    if (percentage < 30) return "bg-gradient-to-r from-red-500 to-red-400"
    if (percentage < 60) return "bg-gradient-to-r from-orange-500 to-yellow-400"
    if (percentage < 90) return "bg-gradient-to-r from-yellow-400 to-green-400"
    return "bg-gradient-to-r from-green-500 to-green-400"
  }

  const getTripStatus = (trip: TripData) => {
    const confirmedNum = Number(trip.confirmed_responses)
    const rejectedNum = Number(trip.rejected_responses)
    const sentNum = Number(trip.sent_messages)
    const totalNum = Number(trip.total_messages)
    const totalResponses = confirmedNum + rejectedNum

    if (sentNum === 0) return "Не отправлена"
    if (trip.status === "completed" || totalResponses === sentNum) return "Завершена"
    if (sentNum < totalNum) return "Отправляется"
    if (trip.status === "active" && Number(trip.pending_responses) > 0) return "Ожидает ответов"
    return "Активна"
  }

  const getTripStatusBadge = (trip: TripData) => {
    const status = getTripStatus(trip)

    switch (status) {
      case "Завершена":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Завершена
          </Badge>
        )
      case "Отправляется":
        return (
          <Badge variant="default" className="bg-blue-600">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Отправляется
          </Badge>
        )
      case "Ожидает ответов":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Ожидает ответов
          </Badge>
        )
      case "Активна":
        return (
          <Badge variant="default" className="bg-blue-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Активна
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  const getTimeSinceSent = (sentAt?: string) => {
    if (!sentAt) return "Не отправлено"

    const now = new Date()
    const sent = new Date(sentAt)
    const diffMs = now.getTime() - sent.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}ч ${diffMinutes}м назад`
    } else {
      return `${diffMinutes}м назад`
    }
  }

  // Проверяем можно ли удалить рассылку
  const canDeleteTrip = (trip: TripData) => {
    const confirmedNum = Number(trip.confirmed_responses)
    const rejectedNum = Number(trip.rejected_responses)
    const sentNum = Number(trip.sent_messages)
    const errorNum = Number(trip.error_messages)
    const totalResponses = confirmedNum + rejectedNum

    return sentNum > 0 && (totalResponses === sentNum || trip.status === "completed" || errorNum > 0)
  }

  const handleDeleteTrip = async (tripId: number) => {
    setDeletingTripId(tripId)
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to delete trip")
      }

      // Обновляем список рассылок
      await fetchTrips()
    } catch (error) {
      console.error("Error deleting trip:", error)
      alert("Ошибка при удалении рассылки")
    } finally {
      setDeletingTripId(null)
      setShowDeleteConfirm(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Рассылки рейсов</h1>
          <p className="text-muted-foreground">Управление рассылками и отслеживание ответов водителей</p>
        </div>
        <Button onClick={fetchTrips} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Загрузка рассылок...
        </div>
      ) : trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Рассылки не найдены</h3>
            <p className="text-muted-foreground text-center mb-4">
              Создайте первую рассылку, загрузив файл с данными о рейсах
            </p>
            <Button asChild>
              <Link href="/upload">Загрузить файл</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const sentPercentage = calculateSentPercentage(trip.sent_messages, trip.total_messages)
            const responsePercentage = calculateResponsePercentage(
              trip.confirmed_responses,
              trip.rejected_responses,
              trip.sent_messages,
            )

            return (
              <Card key={trip.id} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Truck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Рассылка #{trip.id}</CardTitle>
                        <CardDescription className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(trip.created_at)}
                          </span>
                          {trip.first_sent_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getTimeSinceSent(trip.first_sent_at)}
                            </span>
                          )}
                          {trip.carpark && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">Автопарк: {trip.carpark}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline">
                        <Link href={`/trips/${trip.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Детали
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canDeleteTrip(trip) && (
                            <DropdownMenuItem
                              onClick={() => setShowDeleteConfirm(trip.id)}
                              className="text-red-600 focus:text-red-600"
                              disabled={deletingTripId === trip.id}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deletingTripId === trip.id ? "Удаление..." : "Удалить рассылку"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{trip.total_messages}</div>
                      <div className="text-sm text-muted-foreground">Всего</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{trip.sent_messages}</div>
                      <div className="text-sm text-muted-foreground">Отправлено</div>
                    </div>
                    {/* Подтверждено - кликабельное */}
                    <div className="text-center">
                      {Number(trip.confirmed_responses) > 0 ? (
                        <Link
                          href={`/trips/${trip.id}?filter=confirmed`}
                          className="block hover:opacity-80 transition-opacity"
                        >
                          <div className="text-2xl font-bold text-emerald-600 cursor-pointer hover:text-emerald-700 transition-colors">
                            {trip.confirmed_responses}
                          </div>
                          <div className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors">
                            Подтверждено
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-emerald-600">{trip.confirmed_responses}</div>
                          <div className="text-sm text-muted-foreground">Подтверждено</div>
                        </>
                      )}
                    </div>

                    {/* Отклонено - кликабельное */}
                    <div className="text-center">
                      {Number(trip.rejected_responses) > 0 ? (
                        <Link
                          href={`/trips/${trip.id}?filter=rejected`}
                          className="block hover:opacity-80 transition-opacity"
                        >
                          <div className="text-2xl font-bold text-red-600 cursor-pointer hover:text-red-700 transition-colors">
                            {trip.rejected_responses}
                          </div>
                          <div className="text-sm text-muted-foreground hover:text-red-600 transition-colors">
                            Отклонено
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-red-600">{trip.rejected_responses}</div>
                          <div className="text-sm text-muted-foreground">Отклонено</div>
                        </>
                      )}
                    </div>

                    {/* Ожидают - кликабельное */}
                    <div className="text-center">
                      {Number(trip.pending_responses) > 0 ? (
                        <Link
                          href={`/trips/${trip.id}?filter=pending`}
                          className="block hover:opacity-80 transition-opacity"
                        >
                          <div className="text-2xl font-bold text-orange-600 cursor-pointer hover:text-orange-700 transition-colors">
                            {trip.pending_responses}
                          </div>
                          <div className="text-sm text-muted-foreground hover:text-orange-600 transition-colors">
                            Ожидают
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-orange-600">{trip.pending_responses}</div>
                          <div className="text-sm text-muted-foreground">Ожидают</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Прогресс отправки</span>
                        <span className="text-sm text-muted-foreground">{sentPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 transition-all duration-300 ${getProgressColor(sentPercentage)}`}
                          style={{ width: `${sentPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Прогресс ответов</span>
                        <span className="text-sm text-muted-foreground">
                          {responsePercentage}% ({Number(trip.confirmed_responses) + Number(trip.rejected_responses)}/
                          {trip.sent_messages})
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 transition-all duration-300 ${getProgressColor(responsePercentage)}`}
                          style={{ width: `${responsePercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    {getTripStatusBadge(trip)}
                    {Number(trip.error_messages) > 0 && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        {trip.error_messages} ошибок
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Подтверждение удаления</h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить рассылку #{showDeleteConfirm}? Это действие нельзя отменить. Будут удалены
              все связанные данные из базы данных.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingTripId === showDeleteConfirm}
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteTrip(showDeleteConfirm)}
                disabled={deletingTripId === showDeleteConfirm}
              >
                {deletingTripId === showDeleteConfirm ? "Удаление..." : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
