"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bug, RefreshCw, CheckCircle, AlertCircle, ExternalLink } from "lucide-react"

export default function WebhookDebug() {
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<any>(null)

  const setupDebugWebhook = async () => {
    setIsSettingUp(true)
    setSetupResult(null)
    try {
      const response = await fetch("/api/setup-debug-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setSetupResult(data)
    } catch (error) {
      setSetupResult({
        success: false,
        error: "Ошибка при настройке debug webhook",
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Bug className="h-5 w-5" />
          Отладка Webhook
        </CardTitle>
        <CardDescription>Временно переключите webhook на debug-режим для детального логирования</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Bug className="h-4 w-4" />
          <AlertDescription>
            <strong>Как использовать:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Нажмите "Включить Debug Webhook"</li>
              <li>Отправьте сообщение боту и нажмите кнопки</li>
              <li>Проверьте логи в Vercel Dashboard</li>
              <li>Верните обычный webhook после отладки</li>
            </ol>
          </AlertDescription>
        </Alert>

        <Button onClick={setupDebugWebhook} disabled={isSettingUp} className="w-full bg-blue-600 hover:bg-blue-700">
          {isSettingUp ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Настройка Debug Webhook...
            </>
          ) : (
            <>
              <Bug className="mr-2 h-4 w-4" />
              Включить Debug Webhook
            </>
          )}
        </Button>

        {setupResult && (
          <Alert variant={setupResult.success ? "default" : "destructive"}>
            {setupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              <div className="space-y-2">
                <p>{setupResult.success ? setupResult.message : setupResult.error}</p>
                {setupResult.url && (
                  <div className="text-xs">
                    <strong>Debug URL:</strong> {setupResult.url}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Инструкции по отладке:</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline">1</Badge>
              <span>Включите debug webhook выше</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">2</Badge>
              <span>Отправьте тестовое сообщение боту</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              <span>Нажмите кнопки "Подтвердить" и "Отклонить"</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">4</Badge>
              <span>Проверьте логи в Vercel Dashboard</span>
            </div>
          </div>

          <div className="mt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Открыть Vercel Dashboard
              </a>
            </Button>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Важно:</strong> Debug webhook только для отладки! После тестирования обязательно верните обычный
            webhook через "Настроить публичный webhook".
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
