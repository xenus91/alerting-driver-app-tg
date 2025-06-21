"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, RefreshCw, Zap, ExternalLink } from "lucide-react"

export default function WebhookSuccessFix() {
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<any>(null)

  const restoreWorkingWebhook = async () => {
    setIsRestoring(true)
    setRestoreResult(null)
    try {
      const response = await fetch("/api/restore-working-webhook", {
        method: "POST",
      })
      const data = await response.json()
      setRestoreResult(data)
    } catch (error) {
      setRestoreResult({
        success: false,
        error: "Ошибка при восстановлении webhook",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />🎉 Debug webhook работает!
        </CardTitle>
        <CardDescription>
          Callback query успешно получен! Теперь нужно переключить на рабочий webhook для обработки кнопок.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>✅ Отлично!</strong> Ваши логи показывают, что:
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Telegram успешно отправляет callback_query на ваш сервер</li>
              <li>
                Данные приходят правильно: <code>confirm_28</code>
              </li>
              <li>
                User ID: <code>959905827</code>
              </li>
              <li>Проблема только в том, что debug webhook не обрабатывает данные</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button
          onClick={restoreWorkingWebhook}
          disabled={isRestoring}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {isRestoring ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Восстановление рабочего webhook...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Восстановить рабочий webhook
            </>
          )}
        </Button>

        {restoreResult && (
          <Alert variant={restoreResult.success ? "default" : "destructive"}>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>{restoreResult.success ? "✅ Успех!" : "❌ Ошибка!"}</strong>
                </p>
                <p>{restoreResult.message || restoreResult.error}</p>

                {restoreResult.webhook_url && (
                  <div className="text-xs">
                    <strong>Webhook URL:</strong> {restoreResult.webhook_url}
                  </div>
                )}

                {restoreResult.next_steps && (
                  <div>
                    <strong>Следующие шаги:</strong>
                    <ol className="list-decimal list-inside text-sm mt-1">
                      {restoreResult.next_steps.map((step: string, index: number) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Что произойдет после восстановления:</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Webhook переключится на /webhook/telegram</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Кнопки начнут обрабатываться правильно</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Пользователи будут получать уведомления</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Ответы будут сохраняться в базе данных</span>
            </div>
          </div>
        </div>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Тест после восстановления:</strong>
            <ol className="list-decimal list-inside mt-2 text-sm">
              <li>Нажмите кнопку "Восстановить рабочий webhook"</li>
              <li>Дождитесь успешного результата</li>
              <li>Нажмите кнопку "Подтвердить" или "Отклонить" в боте</li>
              <li>Проверьте, что пришло уведомление пользователю</li>
              <li>Проверьте ответы в разделе "Кампании рассылки"</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Vercel Logs
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || "yourbotname"}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Открыть бота
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
