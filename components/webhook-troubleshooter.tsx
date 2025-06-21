"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Wrench,
  Bug,
} from "lucide-react"

export default function WebhookTroubleshooter() {
  const [checkResult, setCheckResult] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)
  const [isFixing, setIsFixing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const checkWebhook = async () => {
    setIsChecking(true)
    setCheckResult(null)
    try {
      const response = await fetch("/api/check-telegram-webhook")
      const data = await response.json()
      setCheckResult(data)
    } catch (error) {
      setCheckResult({
        success: false,
        error: "Ошибка при проверке webhook",
      })
    } finally {
      setIsChecking(false)
    }
  }

  const forceFixWebhook = async () => {
    setIsFixing(true)
    setFixResult(null)
    try {
      const response = await fetch("/api/force-fix-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setFixResult(data)

      // Обновляем проверку через 3 секунды
      setTimeout(checkWebhook, 3000)
    } catch (error) {
      setFixResult({
        success: false,
        error: "Ошибка при исправлении webhook",
      })
    } finally {
      setIsFixing(false)
    }
  }

  const testEndpoint = async (url: string) => {
    try {
      const response = await fetch(url)
      if (response.ok) {
        alert(`✅ Endpoint доступен: ${url}`)
      } else {
        alert(`❌ Endpoint недоступен: ${url} (HTTP ${response.status})`)
      }
    } catch (error) {
      alert(`❌ Ошибка доступа: ${url}\n${error}`)
    }
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-5 w-5" />
          Диагностика проблем с кнопками
        </CardTitle>
        <CardDescription>Комплексная проверка и автоматическое исправление проблем с webhook</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <Bug className="h-4 w-4" />
          <AlertDescription>
            <strong>Проблема:</strong> Кнопки не работают и нет логов от debug webhook. Это означает, что Telegram не
            может достучаться до вашего приложения.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={checkWebhook} disabled={isChecking} variant="outline">
            {isChecking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <Bug className="mr-2 h-4 w-4" />
                Диагностика
              </>
            )}
          </Button>

          <Button onClick={forceFixWebhook} disabled={isFixing} className="bg-orange-600 hover:bg-orange-700">
            {isFixing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Исправление...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Автоисправление
              </>
            )}
          </Button>
        </div>

        {/* Результат проверки */}
        {checkResult && (
          <div className="space-y-3">
            <h4 className="font-semibold">Результат диагностики:</h4>

            {/* Статус endpoints */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Доступность endpoints:</h5>
              {checkResult.endpoint_tests?.map((test: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="font-mono text-xs break-all">{test.url}</span>
                  <div className="flex items-center gap-2">
                    {test.accessible ? (
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
                    <Button variant="ghost" size="sm" onClick={() => testEndpoint(test.url)}>
                      Тест
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Рекомендации */}
            {checkResult.recommendations && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Рекомендации:</h5>
                <div className="space-y-1">
                  {checkResult.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="text-sm p-2 bg-white rounded border-l-4 border-orange-500">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Детали */}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {showDetails ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                  Показать детали
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs">
                  <pre>{JSON.stringify(checkResult, null, 2)}</pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Результат исправления */}
        {fixResult && (
          <Alert variant={fixResult.success ? "default" : "destructive"}>
            {fixResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>{fixResult.success ? "✅ Успех!" : "❌ Ошибка!"}</strong>
                </p>
                <p>{fixResult.message}</p>

                {fixResult.working_endpoint && (
                  <div className="text-xs">
                    <strong>Рабочий endpoint:</strong> {fixResult.working_endpoint}
                  </div>
                )}

                {fixResult.next_actions && (
                  <div>
                    <strong>Следующие шаги:</strong>
                    <ol className="list-decimal list-inside text-sm mt-1">
                      {fixResult.next_actions.map((action: string, index: number) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Быстрые тесты */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Быстрые тесты:</h4>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testEndpoint(`${window.location.origin}/api/test-webhook-access`)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Тест основного endpoint
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testEndpoint(`${window.location.origin}/webhook/telegram`)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Тест публичного webhook
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Если автоисправление не помогло:</strong>
            <ol className="list-decimal list-inside mt-2 text-sm">
              <li>Проверьте настройки безопасности в Vercel</li>
              <li>Убедитесь, что нет защиты паролем на проекте</li>
              <li>Попробуйте переразвернуть приложение</li>
              <li>Проверьте, что TELEGRAM_BOT_TOKEN правильный</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
