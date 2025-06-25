"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
// Добавить импорт нового компонента
// import WebhookDiagnostics from "@/components/webhook-diagnostics"
import { Upload, MessageSquare, Users, Bot, TrendingUp, FileSpreadsheet, AlertCircle, ExternalLink } from "lucide-react"

export default function HomePage() {
  const isLiteEnvironment = typeof window !== "undefined" && window.location.hostname.includes("lite.vusercontent.net")
  const [testResult, setTestResult] = useState<any>(null)
  const [isTestingCallback, setIsTestingCallback] = useState(false)

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

      {/* Исправление URL webhook */}
      {/* Заменить компонент WebhookUrlFix на WebhookDiagnostics */}
      {/*{!isLiteEnvironment && <WebhookDiagnostics />}*/}

      {/* Тест callback query */}
      {/*{!isLiteEnvironment && (*/}
      {/*  <Card className="border-blue-200 bg-blue-50">*/}
      {/*    <CardHeader>*/}
      {/*      <CardTitle className="flex items-center gap-2 text-blue-800">*/}
      {/*        <TestTube className="h-5 w-5" />*/}
      {/*        Тест callback query (кнопок)*/}
      {/*      </CardTitle>*/}
      {/*      <CardDescription className="text-blue-700">Проверим, работают ли кнопки в Telegram боте</CardDescription>*/}
      {/*    </CardHeader>*/}
      {/*    <CardContent className="space-y-4">*/}
      {/*      <div className="flex gap-2">*/}
      {/*        <Button onClick={testCallbackQuery} disabled={isTestingCallback} size="sm">*/}
      {/*          {isTestingCallback ? (*/}
      {/*            <>*/}
      {/*              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />*/}
      {/*              Отправка теста...*/}
      {/*            </>*/}
      {/*          ) : (*/}
      {/*            <>*/}
      {/*              <TestTube className="h-3 w-3 mr-1" />*/}
      {/*              Отправить тест callback*/}
      {/*            </>*/}
      {/*          )}*/}
      {/*        </Button>*/}
      {/*      </div>*/}

      {/*      {testResult && (*/}
      {/*        <Alert className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>*/}
      {/*          <AlertDescription className={testResult.success ? "text-green-800" : "text-red-800"}>*/}
      {/*            {testResult.success ? (*/}
      {/*              <div>*/}
      {/*                ✅ Тестовое сообщение отправлено! Перейдите в Telegram бота и нажмите кнопку "Тест callback".*/}
      {/*                Затем проверьте логи Vercel на предмет callback_query.*/}
      {/*              </div>*/}
      {/*            ) : (*/}
      {/*              <div>❌ {testResult.error}</div>*/}
      {/*            )}*/}
      {/*          </AlertDescription>*/}
      {/*        </Alert>*/}
      {/*      )}*/}

      {/*      <div className="text-xs text-muted-foreground">*/}
      {/*        <p>*/}
      {/*          <strong>Как тестировать:</strong>*/}
      {/*        </p>*/}
      {/*        <ol className="list-decimal list-inside space-y-1 ml-2">*/}
      {/*          <li>Нажмите "Отправить тест callback"</li>*/}
      {/*          <li>Перейдите в Telegram бота</li>*/}
      {/*          <li>Нажмите кнопку "Тест callback"</li>*/}
      {/*          <li>Проверьте логи Vercel - должен появиться callback_query</li>*/}
      {/*        </ol>*/}
      {/*      </div>*/}
      {/*    </CardContent>*/}
      {/*  </Card>*/}
      {/*)}*/}

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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Рассылок в процессе</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Зарегистрированные</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Пользователей в системе</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отправлено сообщений</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">За все время</p>
          </CardContent>
        </Card>
      </div>

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
            {/*<div className="flex items-start gap-3">*/}
            {/*  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">*/}
            {/*    ⚠️*/}
            {/*  </div>*/}
            {/*  <div>*/}
            {/*    <h4 className="font-medium text-red-600">Сначала исправьте webhook URL!</h4>*/}
            {/*    <p className="text-sm text-muted-foreground">*/}
            {/*      Ваш webhook настроен на старое развертывание. Используйте компонент выше для исправления.*/}
            {/*    </p>*/}
            {/*  </div>*/}
            {/*</div>*/}
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
