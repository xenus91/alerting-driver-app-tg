"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Upload,
  MessageSquare,
  Users,
  Bot,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react"

interface Stats {
  activeTrips: number
  registeredUsers: number
  sentMessages: number
}

interface CurrentUser {
  role: string
  carpark?: string
}

export default function HomePage() {
  const isLiteEnvironment = typeof window !== "undefined" && window.location.hostname.includes("lite.vusercontent.net")
  const [testResult, setTestResult] = useState<any>(null)
  const [isTestingCallback, setIsTestingCallback] = useState(false)
  const [stats, setStats] = useState<Stats>({ activeTrips: 0, registeredUsers: 0, sentMessages: 0 })
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Загружаем статистику при монтировании компонента
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setIsLoadingStats(true)
      setStatsError(null)

      const response = await fetch("/api/stats")
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
        setCurrentUser(data.currentUser)
        console.log("Stats loaded:", data.stats)
      } else {
        setStatsError(data.error || "Ошибка при загрузке статистики")
      }
    } catch (error) {
      console.error("Error loading stats:", error)
      setStatsError("Ошибка при загрузке статистики")
    } finally {
      setIsLoadingStats(false)
    }
  }

  const testCallbackQuery = async () => {
    setIsTestingCallback(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/test-callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: 959905827, // Ваш chat ID
        }),
      })

      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: "Ошибка при отправке тестового сообщения",
      })
    } finally {
      setIsTestingCallback(false)
    }
  }

  const quickActions = [
    {
      title: "Загрузить файл",
      description: "Создать новую кампанию рассылки",
      href: "/upload",
      icon: Upload,
      color: "bg-blue-500",
    },
    {
      title: "Просмотр рассылок",
      description: "Управление рассылками и ответами",
      href: "/trips",
      icon: MessageSquare,
      color: "bg-green-500",
    },
    {
      title: "Пользователи",
      description: "Зарегистрированные пользователи",
      href: "/users",
      icon: Users,
      color: "bg-purple-500",
    },
    {
      title: "Пункты",
      description: "Управление пунктами погрузки/разгрузки",
      href: "/points",
      icon: Bot,
      color: "bg-orange-500",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Предупреждение для lite environment */}
      {isLiteEnvironment && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>⚠️ Внимание:</strong> Вы находитесь в среде разработки. Для работы Telegram бота необходимо
            развернуть приложение на Vercel.
          </AlertDescription>
        </Alert>
      )}

      {/* Информация о текущем пользователе */}
      {currentUser && (
        <Alert>
          <AlertDescription>
            <strong>Роль:</strong> {currentUser.role === "admin" ? "Администратор" : "Оператор"}
            {currentUser.carpark && (
              <>
                {" • "}
                <strong>Автопарк:</strong> {currentUser.carpark}
              </>
            )}
            {currentUser.role === "operator" && (
              <span className="text-muted-foreground ml-2">(статистика только для вашего автопарка)</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Быстрые действия */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="cursor-pointer transition-all hover:shadow-md hover:scale-105">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{action.title}</CardTitle>
                <div className={`p-2 rounded-full ${action.color}`}>
                  <action.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные рассылки</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.activeTrips}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentUser?.role === "operator" ? "Рассылок вашего автопарка" : "Рассылок в процессе"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Зарегистрированные</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.registeredUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentUser?.role === "operator" ? "Водителей вашего автопарка" : "Пользователей в системе"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отправлено сообщений</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.sentMessages}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentUser?.role === "operator" ? "Сообщений вашего автопарка" : "За все время"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ошибка загрузки статистики */}
      {statsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{statsError}</span>
            <Button variant="outline" size="sm" onClick={loadStats}>
              Попробовать снова
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Инструкции */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Как начать работу
          </CardTitle>
          <CardDescription>Пошаговое руководство по использованию системы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                ✅
              </div>
              <div>
                <h4 className="font-medium text-green-600">Webhook настроен правильно!</h4>
                <p className="text-sm text-muted-foreground">
                  Система готова к работе. При необходимости диагностики используйте раздел "Настройки бота".
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                1
              </div>
              <div>
                <h4 className="font-medium">Создайте пункты</h4>
                <p className="text-sm text-muted-foreground">
                  Добавьте пункты погрузки и разгрузки с временными окнами
                </p>
                <Link href="/points">
                  <Button variant="outline" size="sm" className="mt-2">
                    Управление пунктами
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                2
              </div>
              <div>
                <h4 className="font-medium">Зарегистрируйте пользователей</h4>
                <p className="text-sm text-muted-foreground">
                  Пользователи должны отправить /start боту и пройти процесс регистрации
                </p>
                {process.env.NEXT_PUBLIC_BOT_USERNAME && (
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <a
                      href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Открыть бота
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                3
              </div>
              <div>
                <h4 className="font-medium">Создайте рассылку</h4>
                <p className="text-sm text-muted-foreground">Загрузите Excel файл с данными рейсов для рассылки</p>
                <Link href="/upload">
                  <Button variant="outline" size="sm" className="mt-2">
                    Загрузить файл
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                4
              </div>
              <div>
                <h4 className="font-medium">Отслеживайте результаты</h4>
                <p className="text-sm text-muted-foreground">
                  Просматривайте статистику отправки и ответы пользователей в реальном времени
                </p>
                <Link href="/trips">
                  <Button variant="outline" size="sm" className="mt-2">
                    Просмотр рассылок
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
