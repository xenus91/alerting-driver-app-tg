"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, RefreshCw, ExternalLink, Trash2 } from "lucide-react"

export default function WebhookUrlFix() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkWebhookStatus = async () => {
    setIsChecking(true)
    try {
      const response = await fetch("/api/check-telegram-webhook")
      const result = await response.json()
      setWebhookInfo(result)
    } catch (error) {
      console.error("Error checking webhook:", error)
    } finally {
      setIsChecking(false)
    }
  }

  const deleteWebhook = async () => {
    setIsDeleting(true)
    setUpdateResult(null)

    try {
      const response = await fetch("/api/force-reset-webhook", {
        method: "POST",
      })

      const result = await response.json()
      setUpdateResult({
        success: result.success,
        message: result.success ? "Webhook удален успешно!" : result.error || "Ошибка при удалении webhook",
      })

      if (result.success) {
        setTimeout(() => {
          checkWebhookStatus()
        }, 1000)
      }
    } catch (error) {
      setUpdateResult({
        success: false,
        message: "Ошибка при удалении webhook",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const updateWebhookUrl = async () => {
    setIsUpdating(true)
    setUpdateResult(null)

    try {
      // Сначала удаляем старый webhook
      const deleteResponse = await fetch("/api/force-reset-webhook", {
        method: "POST",
      })

      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Затем устанавливаем новый
      const response = await fetch("/api/setup-telegram-webhook", {
        method: "POST",
      })

      const result = await response.json()
      setUpdateResult(result)

      if (result.success) {
        setTimeout(() => {
          checkWebhookStatus()
        }, 2000)
      }
    } catch (error) {
      setUpdateResult({
        success: false,
        message: "Ошибка при обновлении webhook URL",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const currentUrl = typeof window !== "undefined" ? window.location.origin : ""
  const expectedWebhookUrl = `${currentUrl}/api/telegram-webhook`

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Критическая проблема с webhook URL
        </CardTitle>
        <CardDescription className="text-orange-700">
          Telegram webhook все еще указывает на старое развертывание. Требуется принудительное обновление.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Диагностика проблемы */}
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="space-y-2">
              <div className="font-medium">Обнаружена проблема:</div>
              <ul className="text-xs space-y-1 ml-4">
                <li>
                  • Запросы приходят на: <code>ps3enz96j-xenus91s-projects.vercel.app</code>
                </li>
                <li>
                  • Текущее приложение: <code>{currentUrl.replace("https://", "")}</code>
                </li>
                <li>• Webhook не обновляется автоматически</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Текущее состояние */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Текущее приложение:</span>
            <Badge variant="outline" className="bg-green-100 text-green-800">
              {currentUrl.replace("https://", "")}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Нужный webhook:</span>
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              /api/telegram-webhook
            </Badge>
          </div>
        </div>

        {/* Информация о webhook */}
        {webhookInfo && (
          <Alert
            className={
              webhookInfo.webhook_url?.includes(currentUrl)
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <AlertDescription>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {webhookInfo.webhook_url?.includes(currentUrl) ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">
                    {webhookInfo.webhook_url?.includes(currentUrl)
                      ? "Webhook настроен правильно!"
                      : "Webhook настроен неправильно"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Текущий URL: {webhookInfo.webhook_url || "Не установлен"}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Результат обновления */}
        {updateResult && (
          <Alert className={updateResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <AlertDescription className={updateResult.success ? "text-green-800" : "text-red-800"}>
              {updateResult.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Кнопки действий */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkWebhookStatus} variant="outline" size="sm" disabled={isChecking}>
            {isChecking ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Проверка...
              </>
            ) : (
              "Проверить статус"
            )}
          </Button>

          <Button onClick={deleteWebhook} variant="destructive" size="sm" disabled={isDeleting}>
            {isDeleting ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Удаление...
              </>
            ) : (
              <>
                <Trash2 className="h-3 w-3 mr-1" />
                Удалить webhook
              </>
            )}
          </Button>

          <Button
            onClick={updateWebhookUrl}
            size="sm"
            disabled={isUpdating}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Принудительное обновление...
              </>
            ) : (
              "🔥 Принудительно обновить"
            )}
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a
              href="https://vercel.com/xenus91s-projects/v0-tg-bot-allerting/functions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Vercel Logs
            </a>
          </Button>
        </div>

        {/* Пошаговые инструкции */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm font-medium text-yellow-800 mb-2">🔧 План исправления:</div>
          <ol className="text-xs text-yellow-700 space-y-1 ml-4">
            <li>1. Нажмите "Удалить webhook" - это очистит старые настройки</li>
            <li>2. Подождите 2-3 секунды</li>
            <li>3. Нажмите "🔥 Принудительно обновить" - установит правильный URL</li>
            <li>4. Нажмите "Проверить статус" - убедитесь что все работает</li>
            <li>5. Протестируйте регистрацию в Telegram боте</li>
          </ol>
        </div>

        {/* Техническая информация */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Техническая проблема:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Vercel создает новые развертывания с разными URL</li>
            <li>Telegram webhook "застрял" на старом URL развертывания</li>
            <li>Нужно принудительно обновить webhook на актуальный URL</li>
            <li>После исправления регистрация пользователей заработает</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
