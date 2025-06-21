"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Bot,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  ExternalLink,
  Copy,
  Globe,
  Trash2,
} from "lucide-react"

interface DiagnosticsData {
  success: boolean
  token_configured?: boolean
  token_format_valid?: boolean
  webhook_accessible?: boolean
  is_lite_environment?: boolean
  is_local_development?: boolean
  is_vercel_deployment?: boolean
  health_check_error?: string
  telegram_webhook_error?: string
  current_telegram_webhook?: {
    url: string
    has_custom_certificate: boolean
    pending_update_count: number
    last_error_date?: number
    last_error_message?: string
  }
  environment?: {
    app_url: string
    expected_webhook_url: string
    node_env: string
    vercel_url: string
    nextauth_url: string
  }
  recommendations?: string[]
  error?: string
  steps?: string[]
}

export default function BotDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [isForceUpdating, setIsForceUpdating] = useState(false)
  const [forceUpdateResult, setForceUpdateResult] = useState<any>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<any>(null)

  const [isSettingUpTelegram, setIsSettingUpTelegram] = useState(false)
  const [telegramSetupResult, setTelegramSetupResult] = useState<any>(null)

  const clearWebhookUpdates = async () => {
    setIsClearing(true)
    setClearResult(null)
    try {
      const response = await fetch("/api/clear-webhook-updates", {
        method: "POST",
      })
      const data = await response.json()
      setClearResult(data)

      if (data.success) {
        setTimeout(fetchDiagnostics, 3000)
      }
    } catch (error) {
      setClearResult({
        success: false,
        error: "Ошибка при очистке обновлений webhook",
      })
    } finally {
      setIsClearing(false)
    }
  }

  const forceUpdateWebhook = async () => {
    setIsForceUpdating(true)
    setForceUpdateResult(null)
    try {
      const response = await fetch("/api/force-webhook-update", {
        method: "POST",
      })
      const data = await response.json()
      setForceUpdateResult(data)

      if (data.success) {
        setTimeout(fetchDiagnostics, 3000)
      }
    } catch (error) {
      setForceUpdateResult({
        success: false,
        error: "Ошибка при принудительном обновлении webhook",
      })
    } finally {
      setIsForceUpdating(false)
    }
  }

  const fetchDiagnostics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/bot-diagnostics")
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setDiagnostics(data)
    } catch (error) {
      console.error("Error fetching diagnostics:", error)
      setDiagnostics({
        success: false,
        error: "Ошибка при получении диагностики. Проверьте консоль для деталей.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const setupWebhook = async () => {
    setIsSettingUp(true)
    setSetupResult(null)
    try {
      const response = await fetch("/api/setup-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setSetupResult(data)

      if (data.success) {
        setTimeout(fetchDiagnostics, 2000)
      }
    } catch (error) {
      setSetupResult({
        success: false,
        error: "Ошибка при настройке webhook",
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const testWebhook = async () => {
    if (!diagnostics?.environment?.expected_webhook_url) return

    try {
      const response = await fetch(diagnostics.environment.expected_webhook_url, {
        method: "GET",
      })
      if (response.ok) {
        alert("✅ Webhook URL доступен!")
      } else {
        alert(`❌ Webhook недоступен: HTTP ${response.status}`)
      }
    } catch (error) {
      alert(`❌ Ошибка при проверке webhook: ${error}`)
    }
  }

  const setupTelegramWebhook = async () => {
    setIsSettingUpTelegram(true)
    setTelegramSetupResult(null)
    try {
      const response = await fetch("/api/setup-telegram-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setTelegramSetupResult(data)

      if (data.success) {
        setTimeout(fetchDiagnostics, 3000)
      }
    } catch (error) {
      setTelegramSetupResult({
        success: false,
        error: "Ошибка при настройке Telegram webhook",
      })
    } finally {
      setIsSettingUpTelegram(false)
    }
  }

  const testTelegramWebhook = async () => {
    try {
      const response = await fetch("/api/test-telegram-webhook")
      const data = await response.json()

      if (data.success) {
        alert("✅ Новый Telegram webhook доступен!")
      } else {
        alert(`❌ Ошибка: ${data.message || data.error}`)
      }
    } catch (error) {
      alert(`❌ Ошибка при тестировании: ${error}`)
    }
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [])

  if (isLoading && !diagnostics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Загрузка диагностики...
        </CardContent>
      </Card>
    )
  }

  const canSetupWebhook =
    diagnostics?.success &&
    !diagnostics.is_lite_environment &&
    !diagnostics.is_local_development &&
    diagnostics.is_vercel_deployment

  const hasPendingUpdates = (diagnostics?.current_telegram_webhook?.pending_update_count || 0) > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Диагностика Telegram бота
            </CardTitle>
            <CardDescription>Проверка настроек и статуса подключения</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDiagnostics} disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!diagnostics || !diagnostics.success ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>Ошибка:</strong> {diagnostics?.error || "Неизвестная ошибка"}
                </p>
                {diagnostics?.steps && (
                  <div>
                    <p>
                      <strong>Что нужно сделать:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {diagnostics.steps.map((step, index) => (
                        <li key={index} className="text-sm">
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Предупреждение о необработанных обновлениях */}
            {hasPendingUpdates && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      <strong>⚠️ Обнаружены необработанные обновления!</strong>
                    </p>
                    <p>
                      В Telegram накопилось {diagnostics.current_telegram_webhook?.pending_update_count} необработанных
                      сообщений. Это означает, что webhook получает ошибки при обработке запросов.
                    </p>
                    <p>
                      <strong>Решение:</strong> Нажмите "Очистить обновления" для сброса накопленных сообщений.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Статус развертывания */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-semibold">Развертывание Vercel</div>
                <div className="text-sm text-muted-foreground">
                  {diagnostics.is_vercel_deployment ? "Приложение развернуто" : "Не обнаружено"}
                </div>
              </div>
              {diagnostics.is_vercel_deployment ? (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Развернуто
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Не развернуто
                </Badge>
              )}
            </div>

            {/* Статус токена */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-semibold">Токен бота</div>
                <div className="text-sm text-muted-foreground">
                  {diagnostics.token_format_valid ? "Формат корректный" : "Проверьте формат токена"}
                </div>
              </div>
              {diagnostics.token_configured ? (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Настроен
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Не настроен
                </Badge>
              )}
            </div>

            {/* Статус webhook */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-semibold">Webhook доступность</div>
                <div className="text-sm text-muted-foreground">
                  {diagnostics.webhook_accessible ? "URL доступен" : "URL недоступен для Telegram"}
                  {diagnostics.health_check_error && (
                    <div className="text-xs text-red-600 mt-1">{diagnostics.health_check_error}</div>
                  )}
                </div>
              </div>
              {diagnostics.webhook_accessible ? (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Доступен
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Недоступен
                </Badge>
              )}
            </div>

            {/* Статус Telegram webhook */}
            {diagnostics.current_telegram_webhook && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-semibold">Telegram webhook</div>
                  <div className="text-sm text-muted-foreground">
                    {diagnostics.current_telegram_webhook.url ? "Настроен в Telegram" : "Не настроен в Telegram"}
                    {diagnostics.current_telegram_webhook.pending_update_count > 0 && (
                      <div className="text-xs text-orange-600 mt-1">
                        {diagnostics.current_telegram_webhook.pending_update_count} необработанных обновлений
                      </div>
                    )}
                  </div>
                </div>
                {diagnostics.current_telegram_webhook.url === diagnostics.environment?.expected_webhook_url ? (
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Правильный
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Неправильный
                  </Badge>
                )}
              </div>
            )}

            {/* Рекомендации */}
            {diagnostics.recommendations && diagnostics.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Статус:</h4>
                <div className="space-y-1">
                  {diagnostics.recommendations.map((rec, index) => (
                    <div key={index} className="text-sm p-2 bg-muted rounded">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="grid grid-cols-2 gap-2">
              {canSetupWebhook ? (
                <Button onClick={setupWebhook} disabled={isSettingUp} className="col-span-2">
                  {isSettingUp ? (
                    <>
                      <Settings className="mr-2 h-4 w-4 animate-spin" />
                      Настройка webhook...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Настроить webhook
                    </>
                  )}
                </Button>
              ) : (
                <Button disabled className="col-span-2">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Webhook недоступен
                </Button>
              )}

              <Button
                variant="default"
                onClick={setupTelegramWebhook}
                disabled={isSettingUpTelegram || !diagnostics.token_configured}
                className="col-span-2"
              >
                {isSettingUpTelegram ? (
                  <>
                    <Settings className="mr-2 h-4 w-4 animate-spin" />
                    Настройка Telegram webhook...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Настроить Telegram webhook (новый endpoint)
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={clearWebhookUpdates}
                disabled={isClearing || !diagnostics.token_configured}
              >
                {isClearing ? (
                  <>
                    <Trash2 className="mr-2 h-4 w-4 animate-spin" />
                    Очистка...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Очистить обновления
                  </>
                )}
              </Button>

              <Button variant="outline" onClick={testTelegramWebhook}>
                <Globe className="mr-2 h-4 w-4" />
                Тест нового webhook
              </Button>
            </div>

            {/* Результат очистки */}
            {clearResult && (
              <Alert variant={clearResult.success ? "default" : "destructive"}>
                {clearResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{clearResult.success ? clearResult.message : clearResult.error}</p>
                    {clearResult.before && clearResult.after && (
                      <div className="text-xs">
                        <div>
                          <strong>До:</strong> {clearResult.before.pending_updates} необработанных обновлений
                        </div>
                        <div>
                          <strong>После:</strong> {clearResult.after.pending_updates} необработанных обновлений
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Результат настройки */}
            {setupResult && (
              <Alert variant={setupResult.success ? "default" : "destructive"}>
                {setupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  {setupResult.success ? setupResult.message : setupResult.error}
                  {setupResult.details && (
                    <div className="mt-2 text-xs">
                      <strong>Детали:</strong> {setupResult.details}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {telegramSetupResult && (
              <Alert variant={telegramSetupResult.success ? "default" : "destructive"}>
                {telegramSetupResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{telegramSetupResult.success ? telegramSetupResult.message : telegramSetupResult.error}</p>
                    {telegramSetupResult.url && (
                      <div className="text-xs">
                        <strong>Новый webhook URL:</strong> {telegramSetupResult.url}
                      </div>
                    )}
                    {telegramSetupResult.verification && (
                      <div className="text-xs">
                        <strong>Проверка:</strong> {telegramSetupResult.verification.pending_update_count}{" "}
                        необработанных обновлений
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Детальная информация */}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {showDetails ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                  Показать детали
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <strong>URL приложения:</strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(diagnostics.environment?.app_url || "")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="font-mono text-xs bg-muted p-2 rounded mt-1">
                      {diagnostics.environment?.app_url}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <strong>Webhook URL:</strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(diagnostics.environment?.expected_webhook_url || "")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="font-mono text-xs bg-muted p-2 rounded mt-1">
                      {diagnostics.environment?.expected_webhook_url}
                    </div>
                  </div>
                  {diagnostics.current_telegram_webhook?.url && (
                    <div>
                      <strong>Текущий webhook в Telegram:</strong>
                      <div className="font-mono text-xs bg-muted p-2 rounded mt-1">
                        {diagnostics.current_telegram_webhook.url}
                      </div>
                    </div>
                  )}
                  <div>
                    <strong>Переменные окружения:</strong>
                    <div className="text-xs bg-muted p-2 rounded mt-1">
                      <div>NODE_ENV: {diagnostics.environment?.node_env}</div>
                      <div>VERCEL_URL: {diagnostics.environment?.vercel_url}</div>
                      <div>NEXTAUTH_URL: {diagnostics.environment?.nextauth_url}</div>
                    </div>
                  </div>
                  {diagnostics.health_check_error && (
                    <div>
                      <strong>Ошибка проверки доступности:</strong>
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-1">
                        {diagnostics.health_check_error}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Инструкции */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2 text-sm">Следующие шаги:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Нажмите "Очистить обновления" для сброса накопленных сообщений</li>
                <li>Отправьте /start боту в Telegram</li>
                <li>Проверьте логи в Vercel Dashboard → Functions</li>
                <li>Если проблема остается, проверьте настройки безопасности Vercel</li>
              </ol>

              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://vercel.com/dashboard`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Vercel Dashboard
                  </a>
                </Button>
                {diagnostics.environment?.app_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={diagnostics.environment.app_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Открыть приложение
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
