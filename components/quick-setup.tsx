"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, ExternalLink, CheckCircle, AlertCircle, Zap } from "lucide-react"

export default function QuickSetup() {
  const [botToken, setBotToken] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  const validateToken = async () => {
    if (!botToken.trim()) {
      setValidationResult({
        success: false,
        error: "Введите токен бота",
      })
      return
    }

    setIsValidating(true)
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      const data = await response.json()

      if (data.ok) {
        setValidationResult({
          success: true,
          bot: data.result,
        })
      } else {
        setValidationResult({
          success: false,
          error: data.description || "Неверный токен",
        })
      }
    } catch (error) {
      setValidationResult({
        success: false,
        error: "Ошибка при проверке токена",
      })
    } finally {
      setIsValidating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Быстрая настройка бота
        </CardTitle>
        <CardDescription>Проверьте токен бота перед добавлением в переменные окружения</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bot-token">Токен Telegram бота</Label>
          <div className="flex gap-2">
            <Input
              id="bot-token"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              type="password"
            />
            <Button onClick={validateToken} disabled={isValidating} variant="outline">
              {isValidating ? "Проверка..." : "Проверить"}
            </Button>
          </div>
        </div>

        {validationResult && (
          <Alert variant={validationResult.success ? "default" : "destructive"}>
            {validationResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {validationResult.success ? (
                <div>
                  <p>
                    <strong>Токен валиден!</strong>
                  </p>
                  <p>Бот: @{validationResult.bot.username}</p>
                  <p>Имя: {validationResult.bot.first_name}</p>
                </div>
              ) : (
                <p>{validationResult.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">Как получить токен бота:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Откройте Telegram и найдите @BotFather</li>
            <li>Отправьте команду /newbot</li>
            <li>Следуйте инструкциям для создания бота</li>
            <li>Скопируйте полученный токен</li>
            <li>Добавьте токен в переменные окружения как TELEGRAM_BOT_TOKEN</li>
          </ol>

          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Открыть BotFather
              </a>
            </Button>
            {validationResult?.success && (
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`TELEGRAM_BOT_TOKEN=${botToken}`)}>
                <Copy className="h-3 w-3 mr-1" />
                Копировать для .env
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
