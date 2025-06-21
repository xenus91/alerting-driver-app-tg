"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, MessageSquare, Users, CheckCircle, XCircle, Clock } from "lucide-react"

interface Stats {
  totalUsers: number
  totalCampaigns: number
  totalMessages: number
  sentMessages: number
  confirmedResponses: number
  rejectedResponses: number
  pendingResponses: number
  todayRegistrations: number
  todayCampaigns: number
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/stats")
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Загрузка статистики...
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Ошибка загрузки статистики</p>
        <Button onClick={fetchStats} className="mt-4">
          Попробовать снова
        </Button>
      </div>
    )
  }

  const responseRate =
    stats.sentMessages > 0 ? ((stats.confirmedResponses + stats.rejectedResponses) / stats.sentMessages) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Статистика системы</h1>
          <p className="text-muted-foreground">Общая статистика работы системы рассылки</p>
        </div>
        <Button onClick={fetchStats} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Основная статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">+{stats.todayRegistrations} сегодня</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Кампании</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">+{stats.todayCampaigns} сегодня</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Сообщения</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">{stats.sentMessages} отправлено</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отклик</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Процент ответов</p>
          </CardContent>
        </Card>
      </div>

      {/* Детальная статистика ответов */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Подтверждено</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmedResponses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sentMessages > 0 ? ((stats.confirmedResponses / stats.sentMessages) * 100).toFixed(1) : 0}% от
              отправленных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отклонено</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejectedResponses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sentMessages > 0 ? ((stats.rejectedResponses / stats.sentMessages) * 100).toFixed(1) : 0}% от
              отправленных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ожидает ответа</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingResponses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sentMessages > 0 ? ((stats.pendingResponses / stats.sentMessages) * 100).toFixed(1) : 0}% от
              отправленных
            </p>
          </CardContent>
        </Card>
      </div>

      {/* График эффективности */}
      {stats.sentMessages > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Эффективность рассылки</CardTitle>
            <CardDescription>Распределение ответов пользователей</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-green-600 transition-all duration-300"
                    style={{
                      width: `${(stats.confirmedResponses / stats.sentMessages) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-red-600 transition-all duration-300"
                    style={{
                      width: `${(stats.rejectedResponses / stats.sentMessages) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-orange-600 transition-all duration-300"
                    style={{
                      width: `${(stats.pendingResponses / stats.sentMessages) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full" />
                  <span>Подтверждено ({stats.confirmedResponses})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full" />
                  <span>Отклонено ({stats.rejectedResponses})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-600 rounded-full" />
                  <span>Ожидает ({stats.pendingResponses})</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
