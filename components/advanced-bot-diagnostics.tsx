"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Bot,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Copy,
  Globe,
  AlertTriangle,
  Shield,
} from "lucide-react"

export default function AdvancedBotDiagnostics() {
  const [webhookInfo, setWebhookInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resetResult, setResetResult] = useState<any>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [publicSetupResult, setPublicSetupResult] = useState<any>(null)
  const [isSettingUpPublic, setIsSettingUpPublic] = useState(false)
  const [pagesSetupResult, setPagesSetupResult] = useState<any>(null)
  const [isSettingUpPages, setIsSettingUpPages] = useState(false)
  const [edgeSetupResult, setEdgeSetupResult] = useState<any>(null)
  const [isSettingUpEdge, setIsSettingUpEdge] = useState(false)

  const fetchWebhookInfo = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/webhook-info")
      const data = await response.json()
      setWebhookInfo(data)
    } catch (error) {
      setWebhookInfo({
        success: false,
        error: "Ошибка при получении информации",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const forceResetWebhook = async () => {
    setIsResetting(true)
    setResetResult(null)
    try {
      const response = await fetch("/api/force-reset-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setResetResult(data)

      // Обновляем информацию через 3 секунды
      setTimeout(fetchWebhookInfo, 3000)
    } catch (error) {
      setResetResult({
        success: false,
        error: "Ошибка при принудительном сбросе webhook",
      })
    } finally {
      setIsResetting(false)
    }
  }

  const setupPublicWebhook = async () => {
    setIsSettingUpPublic(true)
    setPublicSetupResult(null)
    try {
      const response = await fetch("/api/setup-public-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setPublicSetupResult(data)

      // Обновляем информацию через 3 секунды
      setTimeout(fetchWebhookInfo, 3000)
    } catch (error) {
      setPublicSetupResult({
        success: false,
        error: "Ошибка при настройке публичного webhook",
      })
    } finally {
      setIsSettingUpPublic(false)
    }
  }

  const setupPagesWebhook = async () => {
    setIsSettingUpPages(true)
    setPagesSetupResult(null)
    try {
      const response = await fetch("/api/setup-pages-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setPagesSetupResult(data)

      // Обновляем информацию через 3 секунды
      setTimeout(fetchWebhookInfo, 3000)
    } catch (error) {
      setPagesSetupResult({
        success: false,
        error: "Ошибка при настройке Pages API webhook",
      })
    } finally {
      setIsSettingUpPages(false)
    }
  }

  const setupEdgeWebhook = async () => {
    setIsSettingUpEdge(true)
    setEdgeSetupResult(null)
    try {
      const response = await fetch("/api/setup-edge-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setEdgeSetupResult(data)

      // Обновляем информацию через 3 секунды
      setTimeout(fetchWebhookInfo, 3000)
    } catch (error) {
      setEdgeSetupResult({
        success: false,
        error: "Ошибка при настройке Edge Function webhook",
      })
    } finally {
      setIsSettingUpEdge(false)
    }
  }

  const testPingEndpoint = async () => {
    try {
      const response = await fetch("/api/ping")
      const data = await response.json()

      if (response.ok) {
        alert(`✅ Ping успешен!\nСтатус: ${data.status}\nВремя: ${data.timestamp}`)
      } else {
        alert(`❌ Ping неудачен: HTTP ${response.status}`)
      }
    } catch (error) {
      alert(`❌ Ошибка ping: ${error}`)
    }
  }

  const testPublicWebhook = async () => {
    try {
      const appUrl = webhookInfo?.app_url || window.location.origin
      const publicWebhookUrl = `${appUrl}/webhook/telegram`

      const response = await fetch(publicWebhookUrl, {
        method: "GET",
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ Публичный webhook доступен!\nСтатус: ${data.status}`)
      } else {
        alert(`❌ Публичный webhook недоступен: HTTP ${response.status}`)
      }
    } catch (error) {
      alert(`❌ Ошибка тестирования публичного webhook: ${error}`)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Расширенная диагностика
            </CardTitle>
            <CardDescription>Детальная проверка webhook и Telegram API</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWebhookInfo} disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!webhookInfo && !isLoading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Нажмите "Обновить" для получения информации о webhook</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Загрузка информации...
          </div>
        )}

        {webhookInfo && (
          <div className="space-y-4">
            {/* Информация о боте */}
            {webhookInfo.bot_info && (
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold mb-2">Информация о боте</h4>
                <div className="text-sm space-y-1">
                  <div>
                    <strong>Имя:</strong> {webhookInfo.bot_info.first_name}
                  </div>
                  <div>
                    <strong>Username:</strong> @{webhookInfo.bot_info.username}
                  </div>
                  <div>
                    <strong>ID:</strong> {webhookInfo.bot_info.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>Статус:</strong>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Активен
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Информация о webhook */}
            {webhookInfo.webhook_info && (
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold mb-2">Текущий webhook</h4>
                <div className="text-sm space-y-1">
                  <div>
                    <strong>URL:</strong>
                    <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                      {webhookInfo.webhook_info.url || "Не установлен"}
                    </div>
                  </div>
                  <div>
                    <strong>Ожидающие обновления:</strong> {webhookInfo.webhook_info.pending_update_count || 0}
                  </div>
                  {webhookInfo.webhook_info.last_error_message && (
                    <div>
                      <strong>Последняя ошибка:</strong>
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-1">
                        {webhookInfo.webhook_info.last_error_message}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Публичный webhook */}
            <div className="p-3 border rounded-lg bg-green-50">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Публичный webhook (рекомендуется)
              </h4>
              <div className="text-sm space-y-1">
                <div>
                  <strong>URL:</strong>
                  <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                    {webhookInfo.app_url}/webhook/telegram
                  </div>
                </div>
                <div className="text-xs text-green-700">
                  ✅ Этот endpoint не требует аутентификации и должен работать с Telegram
                </div>
              </div>
            </div>

            {/* Последние обновления */}
            {webhookInfo.recent_updates && webhookInfo.recent_updates.length > 0 && (
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold mb-2">Последние обновления ({webhookInfo.recent_updates.length})</h4>
                <div className="text-xs space-y-2 max-h-40 overflow-y-auto">
                  {webhookInfo.recent_updates.map((update: any, index: number) => (
                    <div key={index} className="bg-muted p-2 rounded">
                      <div>
                        <strong>Update ID:</strong> {update.update_id}
                      </div>
                      {update.message && (
                        <div>
                          <strong>Сообщение:</strong> {update.message.text || "Контакт/Медиа"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="default"
                onClick={setupPublicWebhook}
                disabled={isSettingUpPublic}
                className="col-span-2 bg-green-600 hover:bg-green-700"
              >
                {isSettingUpPublic ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Настройка публичного webhook...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Настроить публичный webhook
                  </>
                )}
              </Button>

              <Button
                variant="default"
                onClick={setupPagesWebhook}
                disabled={isSettingUpPages}
                className="col-span-2 bg-blue-600 hover:bg-blue-700"
              >
                {isSettingUpPages ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Настройка Pages API webhook...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Настроить Pages API webhook
                  </>
                )}
              </Button>

              <Button
                variant="default"
                onClick={setupEdgeWebhook}
                disabled={isSettingUpEdge}
                className="col-span-2 bg-purple-600 hover:bg-purple-700"
              >
                {isSettingUpEdge ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Настройка Edge Function webhook...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Настроить Edge Function webhook
                  </>
                )}
              </Button>

              <Button variant="destructive" onClick={forceResetWebhook} disabled={isResetting}>
                {isResetting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Принудительный сброс...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Принудительный сброс
                  </>
                )}
              </Button>

              <Button variant="outline" onClick={testPublicWebhook}>
                <Globe className="mr-2 h-4 w-4" />
                Тест публичного webhook
              </Button>

              <Button variant="outline" onClick={testPingEndpoint}>
                <Globe className="mr-2 h-4 w-4" />
                Ping тест
              </Button>

              <Button
                variant="outline"
                onClick={() => copyToClipboard(`${webhookInfo.app_url}/webhook/telegram`)}
                disabled={!webhookInfo.app_url}
                className="col-span-2"
              >
                <Copy className="mr-2 h-4 w-4" />
                Копировать публичный URL
              </Button>
            </div>

            {/* Результат настройки публичного webhook */}
            {publicSetupResult && (
              <Alert variant={publicSetupResult.success ? "default" : "destructive"}>
                {publicSetupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{publicSetupResult.success ? publicSetupResult.message : publicSetupResult.error}</p>
                    {publicSetupResult.url && (
                      <div className="text-xs">
                        <strong>Публичный webhook URL:</strong> {publicSetupResult.url}
                      </div>
                    )}
                    {publicSetupResult.endpoint_accessible !== undefined && (
                      <div className="text-xs">
                        <strong>Endpoint доступен:</strong> {publicSetupResult.endpoint_accessible ? "Да" : "Нет"}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Результат настройки Pages API webhook */}
            {pagesSetupResult && (
              <Alert variant={pagesSetupResult.success ? "default" : "destructive"}>
                {pagesSetupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{pagesSetupResult.success ? pagesSetupResult.message : pagesSetupResult.error}</p>
                    {pagesSetupResult.url && (
                      <div className="text-xs">
                        <strong>Pages API webhook URL:</strong> {pagesSetupResult.url}
                      </div>
                    )}
                    {pagesSetupResult.endpoint_accessible !== undefined && (
                      <div className="text-xs">
                        <strong>Endpoint доступен:</strong> {pagesSetupResult.endpoint_accessible ? "Да" : "Нет"}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Результат настройки Edge Function webhook */}
            {edgeSetupResult && (
              <Alert variant={edgeSetupResult.success ? "default" : "destructive"}>
                {edgeSetupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{edgeSetupResult.success ? edgeSetupResult.message : edgeSetupResult.error}</p>
                    {edgeSetupResult.url && (
                      <div className="text-xs">
                        <strong>Edge Function webhook URL:</strong> {edgeSetupResult.url}
                      </div>
                    )}
                    {edgeSetupResult.runtime && (
                      <div className="text-xs">
                        <strong>Runtime:</strong> {edgeSetupResult.runtime}
                      </div>
                    )}
                    {edgeSetupResult.endpoint_accessible !== undefined && (
                      <div className="text-xs">
                        <strong>Endpoint доступен:</strong> {edgeSetupResult.endpoint_accessible ? "Да" : "Нет"}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Результат сброса */}
            {resetResult && (
              <Alert variant={resetResult.success ? "default" : "destructive"}>
                {resetResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  <div className="space-y-2">
                    <p>{resetResult.success ? resetResult.message : resetResult.error}</p>
                    {resetResult.endpoint_accessible !== undefined && (
                      <div className="text-xs">
                        <strong>Endpoint доступен:</strong> {resetResult.endpoint_accessible ? "Да" : "Нет"}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Детальная информация о шагах */}
            {resetResult?.steps && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showDetails ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                    Показать детали сброса
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 space-y-2">
                    {resetResult.steps.map((step: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                        <span className="font-medium">{step.step}</span>
                        <div className="flex items-center gap-2">
                          {step.success ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Успех
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Ошибка
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Инструкции */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Решение проблемы HTTP 401:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Нажмите "Настроить публичный webhook" (зеленая кнопка)</li>
            <li>Дождитесь успешной настройки</li>
            <li>Отправьте /start боту в Telegram</li>
            <li>Проверьте логи - должны появиться записи от /webhook/telegram</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
