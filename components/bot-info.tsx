"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bot, Settings, RefreshCw, CheckCircle, AlertCircle, ExternalLink } from "lucide-react"

interface WebhookInfo {
  ok: boolean
  result?: {
    url: string
    has_custom_certificate: boolean
    pending_update_count: number
    last_error_date?: number
    last_error_message?: string
    max_connections?: number
  }
}

export default function BotInfo() {
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<any>(null)

  const fetchWebhookInfo = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/setup-webhook")
      const data = await response.json()
      setWebhookInfo(data)
    } catch (error) {
      console.error("Error fetching webhook info:", error)
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
        // Обновляем информацию о webhook после успешной настройки
        setTimeout(fetchWebhookInfo, 1000)
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

  useEffect(() => {
    fetchWebhookInfo()
  }, [])

  const isWebhookActive = webhookInfo?.ok && webhookInfo?.result?.url

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Статус Telegram бота
        </CardTitle>
        <CardDescription>Настройки и статус подключения бота</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Статус webhook:</span>
          <div className="flex items-center gap-2">
            {isWebhookActive ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Активен
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Не настроен
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={fetchWebhookInfo} disabled={isLoading}>
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {webhookInfo?.result && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL:</span>
              <span className="font-mono text-xs break-all">{webhookInfo.result.url || "Не установлен"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ожидающие обновления:</span>
              <span>{webhookInfo.result.pending_update_count || 0}</span>
            </div>
            {webhookInfo.result.last_error_message && (
              <div className="text-xs text-red-600">
                <strong>Последняя ошибка:</strong> {webhookInfo.result.last_error_message}
              </div>
            )}
          </div>
        )}

        {!isWebhookActive && (
          <Button onClick={setupWebhook} disabled={isSettingUp} className="w-full">
            {isSettingUp ? (
              <>
                <Settings className="mr-2 h-4 w-4 animate-spin" />
                Настройка webhook...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Настроить webhook
              </>
            )}
          </Button>
        )}

        {setupResult && (
          <Alert variant={setupResult.success ? "default" : "destructive"}>
            {setupResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {setupResult.success ? setupResult.message : setupResult.error}
              {setupResult.url && (
                <div className="mt-2 text-xs font-mono break-all">Webhook URL: {setupResult.url}</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Команды бота:</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <code>/start</code>
              <span>Начать работу с ботом</span>
            </div>
            <div className="flex justify-between">
              <span>Поделиться контактом</span>
              <span>Регистрация в системе</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Проверка бота:</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Найдите вашего бота в Telegram и отправьте команду /start
          </p>
          {process.env.NEXT_PUBLIC_BOT_USERNAME && (
            <Button variant="outline" size="sm" asChild>
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
      </CardContent>
    </Card>
  )
}
