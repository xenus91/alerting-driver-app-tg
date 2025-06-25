"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, RefreshCw, Wrench, Eye } from "lucide-react"

export default function WebhookDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)

  const runDiagnostics = async () => {
    setIsChecking(true)
    try {
      const response = await fetch("/api/webhook-diagnostics")
      const result = await response.json()
      setDiagnostics(result)
    } catch (error) {
      console.error("Error running diagnostics:", error)
    } finally {
      setIsChecking(false)
    }
  }

  const fixWebhook = async () => {
    setIsFixing(true)
    setFixResult(null)

    try {
      const response = await fetch("/api/webhook-diagnostics", {
        method: "POST",
      })
      const result = await response.json()
      setFixResult(result)

      // Обновляем диагностику после исправления
      setTimeout(() => {
        runDiagnostics()
      }, 2000)
    } catch (error) {
      setFixResult({
        success: false,
        error: "Ошибка при исправлении webhook",
      })
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-5 w-5" />🔧 Диагностика webhook URL
        </CardTitle>
        <CardDescription className="text-red-700">Полная диагностика проблемы с callback query</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Кнопки управления */}
        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={isChecking} size="sm" variant="outline">
            {isChecking ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Диагностика...
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Запустить диагностику
              </>
            )}
          </Button>

          <Button onClick={fixWebhook} disabled={isFixing} size="sm" className="bg-red-600 hover:bg-red-700">
            {isFixing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Исправление...
              </>
            ) : (
              <>
                <Wrench className="h-3 w-3 mr-1" />🔥 ПРИНУДИТЕЛЬНО ИСПРАВИТЬ
              </>
            )}
          </Button>
        </div>

        {/* Результаты диагностики */}
        {diagnostics && (
          <div className="space-y-3">
            <div className="text-sm font-medium">📊 Резу��ьтаты диагностики:</div>

            <div className="grid gap-2 text-xs">
              <div className="flex justify-between items-center">
                <span>Текущий URL приложения:</span>
                <Badge variant="outline" className="bg-blue-100">
                  {diagnostics.current_app_url?.replace("https://", "")}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span>Ожидаемый webhook:</span>
                <Badge variant="outline" className="bg-green-100">
                  {diagnostics.expected_webhook_url?.replace(diagnostics.current_app_url, "")}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span>Фактический webhook:</span>
                <Badge variant="outline" className={diagnostics.webhook_matches ? "bg-green-100" : "bg-red-100"}>
                  {diagnostics.actual_webhook_info?.url?.replace("https://", "") || "Не установлен"}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span>Статус совпадения:</span>
                {diagnostics.webhook_matches ? (
                  <Badge className="bg-green-600">✅ Совпадает</Badge>
                ) : (
                  <Badge variant="destructive">❌ НЕ совпадает</Badge>
                )}
              </div>
            </div>

            {/* Детали окружения */}
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">🔍 Детали окружения</summary>
              <div className="mt-2 space-y-1 ml-4">
                <div>NODE_ENV: {diagnostics.environment.NODE_ENV}</div>
                <div>VERCEL_URL: {diagnostics.environment.VERCEL_URL}</div>
                <div>VERCEL_BRANCH_URL: {diagnostics.environment.VERCEL_BRANCH_URL || "не установлен"}</div>
                <div>
                  VERCEL_PROJECT_PRODUCTION_URL:{" "}
                  {diagnostics.environment.VERCEL_PROJECT_PRODUCTION_URL || "не установлен"}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Результат исправления */}
        {fixResult && (
          <Alert className={fixResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <AlertDescription className={fixResult.success ? "text-green-800" : "text-red-800"}>
              {fixResult.success ? (
                <div>
                  ✅ Webhook успешно исправлен!
                  <div className="text-xs mt-1">Новый URL: {fixResult.final_webhook_info?.url}</div>
                </div>
              ) : (
                <div>❌ Ошибка: {fixResult.error}</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Инструкции */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm font-medium text-yellow-800 mb-2">🎯 План действий:</div>
          <ol className="text-xs text-yellow-700 space-y-1 ml-4">
            <li>1. Нажмите "Запустить диагностику" - увидите проблему</li>
            <li>2. Нажмите "🔥 ПРИНУДИТЕЛЬНО ИСПРАВИТЬ" - исправит webhook</li>
            <li>3. Повторите тест callback - теперь должно работать</li>
            <li>4. Проверьте логи - должны появиться callback_query</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
