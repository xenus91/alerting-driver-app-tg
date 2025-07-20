"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, CheckCircle, Clock, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TripCorrectionModal } from "@/components/trip-correction-modal" // Импортируем модалку
import { TripTable } from "@/components/trip-table"

interface TripData {
  id: number
  created_at: string
  status: string
  total_messages: string | number
  sent_messages: string | number
  error_messages: string | number
  confirmed_responses: string | number
  rejected_responses: string | number
  declined_responses: string | number
  pending_responses: string | number
  first_sent_at?: string
  last_sent_at?: string
  carpark?: string
}

interface TripError {
  id: number
  phone: string
  error_message: string
  created_at: string
  user_name?: string
}

export default function TripsPage() {
  const { toast } = useToast()
  const [trips, setTrips] = useState<TripData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingTripId, setDeletingTripId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"edit" | "create">("create")
  const [selectedTripForEdit, setSelectedTripForEdit] = useState<{
    tripId: number
    phone: string
    driverName: string
  } | null>(null)
  const [currentUser, setCurrentUser] = useState<{ telegram_id?: number } | null>(null)

  // Состояния для диалога ошибок
  const [showErrorsDialog, setShowErrorsDialog] = useState<number | null>(null)
  const [tripErrors, setTripErrors] = useState<TripError[]>([])
  const [loadingErrors, setLoadingErrors] = useState(false)

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

  const fetchTripErrors = async (tripId: number) => {
    setLoadingErrors(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/errors`)
      const data = await response.json()
      if (data.success) {
        setTripErrors(data.errors)
      }
    } catch (error) {
      console.error("Error fetching trip errors:", error)
    } finally {
      setLoadingErrors(false)
    }
  }

  const handleShowErrors = (tripId: number) => {
    setShowErrorsDialog(tripId)
    fetchTripErrors(tripId)
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("380") && phone.length === 12) {
      // Украинский номер: 380668863317 -> +380 (66) 886-33-17
      return `+380 (${phone.slice(3, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
    } else if (phone.startsWith("7") && phone.length === 11) {
      // Российский номер: 79050550020 -> +7 (905) 055-00-20
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`
    }
    return phone
  }

  // Функция для расшифровки ошибок Telegram API
  const translateTelegramError = (errorMessage: string, userName?: string) => {
    const userNameText = userName && userName.trim() ? userName : "Неизвестный пользователь"

    if (errorMessage.includes("bot was blocked by the user")) {
      return {
        userFriendly: `🤖 Пользователь ${userNameText} заблокировал бота или удалил чат с ним.`,
        instruction: "Пользователю необходимо повторно открыть бота и отправить /start",
      }
    }

    if (errorMessage.includes("chat not found")) {
      return {
        userFriendly: `👻 Пользователь ${userNameText} не найден в Telegram или не начинал диалог с ботом.`,
        instruction: "Пользователю необходимо найти бота в Telegram и отправить /start",
      }
    }

    if (errorMessage.includes("user is deactivated")) {
      return {
        userFriendly: `🚫 Аккаунт пользователя ${userNameText} деактивирован в Telegram.`,
        instruction: "Пользователю необходимо восстановить свой аккаунт в Telegram",
      }
    }

    if (errorMessage.includes("Too Many Requests")) {
      return {
        userFriendly: `⏰ Превышен лимит запросов к Telegram API.`,
        instruction: "Повторите отправку через несколько минут",
      }
    }

    if (errorMessage.includes("message is too long")) {
      return {
        userFriendly: `📏 Сообщение для пользователя ${userNameText} слишком длинное.`,
        instruction: "Сократите текст сообщения и повторите отправку",
      }
    }

    if (errorMessage.includes("Bad Request: invalid phone number")) {
      return {
        userFriendly: `📱 Неверный формат номера телефона пользователя ${userNameText}.`,
        instruction: "Проверьте правильность номера телефона в базе данных",
      }
    }

    // Если ошибка не распознана, возвращаем общее сообщение
    return {
      userFriendly: `❌ Ошибка отправки сообщения пользователю ${userNameText}.`,
      instruction: "Обратитесь к администратору для решения проблемы",
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/me")
        const data = await response.json()
        if (data.success) {
          setCurrentUser(data.user)
        }
      } catch (error) {
        console.error("Error getting current user:", error)
      }
    }

    getCurrentUser()
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
    declined: string | number, // Добавляем declined
    sent: string | number,
  ) => {
    const confirmedNum = Number(confirmed)
    const rejectedNum = Number(rejected)
    const declinedNum = Number(declined) // Добавляем declined
    const sentNum = Number(sent)

    if (sentNum === 0) return 0
    const totalResponses = confirmedNum + rejectedNum + declinedNum
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
    const declinedNum = Number(trip.declined_responses)
    const sentNum = Number(trip.sent_messages)
    const totalNum = Number(trip.total_messages)
    const totalResponses = confirmedNum + rejectedNum + declinedNum

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

  const getCardBackgroundColor = (trip: TripData) => {
    const confirmedNum = Number(trip.confirmed_responses)
    const rejectedNum = Number(trip.rejected_responses)
    const declinedNum = Number(trip.declined_responses)
    const pendingNum = Number(trip.pending_responses)
    const sentNum = Number(trip.sent_messages)

    // Если есть отклонения - бледно красный
    if (rejectedNum > 0) {
      return "bg-red-50 border-red-100"
    }

    // Если все ответы получены и все положительные - бледно зеленый
    if (sentNum > 0 && pendingNum === 0 && confirmedNum === sentNum) {
      return "bg-green-50 border-green-100"
    }

    // Если есть ожидающие ответы - бледно желтый
    if (pendingNum > 0) {
      return "bg-yellow-50 border-yellow-100"
    }

    // По умолчанию - обычный фон
    return "bg-white border-gray-200"
  }

  const getTimeSinceSent = (trip: TripData, sentAt?: string) => {
    if (!sentAt) return "Не отправлено"

    const confirmedNum = Number(trip.confirmed_responses)
    const rejectedNum = Number(trip.rejected_responses)
    const declinedNum = Number(trip.declined_responses)
    const sentNum = Number(trip.sent_messages)
    const totalResponses = confirmedNum + rejectedNum

    const sent = new Date(sentAt)
    let endTime: Date

    // Если получены все ответы, используем время последнего ответа
    if (totalResponses === sentNum && sentNum > 0) {
      // Используем last_sent_at как приблизительное время завершения
      // В реальности нужно было бы хранить время последнего ответа
      endTime = trip.last_sent_at ? new Date(trip.last_sent_at) : new Date()
    } else {
      // Иначе считаем до текущего времени
      endTime = new Date()
    }

    const diffMs = endTime.getTime() - sent.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    const timeText = diffHours > 0 ? `${diffHours}ч ${diffMinutes}м` : `${diffMinutes}м`

    // Добавляем индикатор завершения
    if (totalResponses === sentNum && sentNum > 0) {
      return `${timeText} (завершено)`
    } else {
      return `${timeText} назад`
    }
  }

  // Проверяем можно ли удалить рассылку
  const canDeleteTrip = (trip: TripData) => {
    const confirmedNum = Number(trip.confirmed_responses)
    const rejectedNum = Number(trip.rejected_responses)
    const declinedNum = Number(trip.declined_responses)
    const sentNum = Number(trip.sent_messages)
    const errorNum = Number(trip.error_messages)
    const totalResponses = confirmedNum + rejectedNum + declinedNum

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

  const handleOpenCorrectionModal = (tripId: number, phone: string, driverName: string) => {
    setModalMode("edit")
    setSelectedTripForEdit({ tripId, phone, driverName })
    setIsCorrectionModalOpen(true)
  }

  const handleOpenCreateModal = () => {
    setModalMode("create")
    setSelectedTripForEdit(null)
    setIsCorrectionModalOpen(true)
  }

  const handleCloseCorrectionModal = () => {
    setIsCorrectionModalOpen(false)
    setSelectedTripForEdit(null)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Управление рассылками</h1>
          <Button onClick={handleOpenCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Быстрая рассылка
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Список рассылок</CardTitle>
            <CardDescription>Просмотр и управление всеми созданными рассылками.</CardDescription>
          </CardHeader>
          <CardContent>
            <TripTable onOpenCorrectionModal={handleOpenCorrectionModal} />
          </CardContent>
        </Card>

        <TripCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={handleCloseCorrectionModal}
          mode={modalMode}
          tripId={selectedTripForEdit?.tripId}
          phone={selectedTripForEdit?.phone}
          driverName={selectedTripForEdit?.driverName}
          onOpenConflictTrip={handleOpenCorrectionModal} // Передаем эту же функцию для открытия конфликта
        />
      </main>
    </div>
  )
}
