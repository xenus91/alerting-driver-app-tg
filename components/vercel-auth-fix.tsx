"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Shield, AlertTriangle, Settings } from "lucide-react"

export default function VercelAuthFix() {
  const projectUrl = typeof window !== "undefined" ? window.location.hostname : ""
  const dashboardUrl = `https://vercel.com/dashboard`

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          Проблема: Vercel требует аутентификацию
        </CardTitle>
        <CardDescription>
          Ваше приложение защищено паролем, что блокирует доступ Telegram к webhook endpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Обнаружена проблема:</strong> Vercel показывает страницу входа вместо API endpoint. Это означает,
            что проект защищен аутентификацией на уровне всего приложения.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-semibold text-red-700">🔧 Как исправить:</h4>

          <div className="space-y-4">
            <div className="p-3 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">Шаг 1</Badge>
                <span className="font-semibold">Откройте Vercel Dashboard</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Перейдите в настройки вашего проекта в Vercel</p>
              <Button variant="outline" size="sm" asChild>
                <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Открыть Vercel Dashboard
                </a>
              </Button>
            </div>

            <div className="p-3 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">Шаг 2</Badge>
                <span className="font-semibold">Найдите ваш проект</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Найдите проект с именем содержащим "tg-bot-allerting" или похожим
              </p>
            </div>

            <div className="p-3 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">Шаг 3</Badge>
                <span className="font-semibold">Откройте Settings → Security</span>
              </div>
              <p className="text-sm text-muted-foreground">
                В настройках проекта найдите раздел "Security" или "Protection"
              </p>
            </div>

            <div className="p-3 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="destructive">Шаг 4</Badge>
                <span className="font-semibold">Отключите защиту</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Найдите и отключите одну из этих настроек:</p>
                <ul className="list-disc list-inside ml-4">
                  <li>Password Protection</li>
                  <li>Vercel Authentication</li>
                  <li>Access Control</li>
                  <li>Deployment Protection</li>
                </ul>
              </div>
            </div>

            <div className="p-3 border border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="bg-green-600">
                  Шаг 5
                </Badge>
                <span className="font-semibold">Проверьте результат</span>
              </div>
              <p className="text-sm text-muted-foreground">
                После отключения защиты, API endpoints должны стать доступными без аутентификации
              </p>
            </div>
          </div>
        </div>

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <strong>Альтернативное решение:</strong> Если не можете найти настройки защиты, попробуйте создать новый
            проект Vercel без защиты или обратитесь к администратору аккаунта Vercel.
          </AlertDescription>
        </Alert>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">После отключения защиты:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Подождите 1-2 минуты для применения изменений</li>
            <li>Вернитесь в диагностику бота и нажмите "Обновить"</li>
            <li>Попробуйте настроить webhook заново</li>
            <li>Отправьте /start боту в Telegram для проверки</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="font-semibold text-yellow-700">Важно!</span>
          </div>
          <p className="text-sm text-yellow-700">
            Отключение защиты сделает ваше приложение публично доступным. Убедитесь, что в нем нет конфиденциальной
            информации.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
