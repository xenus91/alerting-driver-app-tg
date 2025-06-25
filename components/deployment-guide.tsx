"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Rocket,
  Database,
  Bot,
  CheckCircle,
  Copy,
  Globe,
  AlertTriangle,
} from "lucide-react"
import { useState } from "react"

export default function DeploymentGuide() {
  const [showSteps, setShowSteps] = useState(false)
  const [showEnvVars, setShowEnvVars] = useState(false)
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const envVarsExample = `# База данных PostgreSQL (обязательно)
DATABASE_URL=postgresql://username:password@host:port/database

# Токен Telegram бота (обязательно)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

  const vercelConfigExample = `{
  "functions": {
    "app/api/webhook/route.ts": {
      "maxDuration": 10
    },
    "app/api/send-messages/route.ts": {
      "maxDuration": 30
    }
  }
}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Развертывание на Vercel
        </CardTitle>
        <CardDescription>Пошаговая инструкция для развертывания приложения</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Globe className="h-4 w-4" />
          <AlertDescription>
            <strong>Важно:</strong> Для работы Telegram бота необходим публичный HTTPS URL. Vercel предоставляет его
            автоматически.
          </AlertDescription>
        </Alert>

        {/* Быстрое развертывание */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Быстрое развертывание
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Vercel Dashboard
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://neon.tech" target="_blank" rel="noopener noreferrer">
                <Database className="h-3 w-3 mr-1" />
                Neon Database
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                <Bot className="h-3 w-3 mr-1" />
                BotFather
              </a>
            </Button>
          </div>
        </div>

        {/* Пошаговые инструкции */}
        <Collapsible open={showSteps} onOpenChange={setShowSteps}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {showSteps ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Подробн��е инструкции
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">
                    1
                  </Badge>
                  <div>
                    <h5 className="font-semibold">Подготовка</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Создайте Telegram бота через @BotFather</li>
                      <li>• Получите токен бота</li>
                      <li>• Создайте PostgreSQL базу данных на Neon</li>
                      <li>• Скачайте код проекта (кнопка "Download Code")</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">
                    2
                  </Badge>
                  <div>
                    <h5 className="font-semibold">Развертывание</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Загрузите код на GitHub (или используйте Vercel CLI)</li>
                      <li>• Откройте Vercel Dashboard</li>
                      <li>• Импортируйте проект из GitHub</li>
                      <li>• Добавьте переменные окружения</li>
                      <li>• Нажмите "Deploy"</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">
                    3
                  </Badge>
                  <div>
                    <h5 className="font-semibold">Настройка после развертывания</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Откройте ваше приложение по Vercel URL</li>
                      <li>• Выполните SQL скрипт для создания таблиц</li>
                      <li>• Настройте webhook в диагностике бота</li>
                      <li>• Протестируйте бота командой /start</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Переменные окружения */}
        <Collapsible open={showEnvVars} onOpenChange={setShowEnvVars}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {showEnvVars ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Переменные окружения
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-semibold">Добавьте в Vercel:</h5>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(envVarsExample)}>
                  <Copy className="h-3 w-3 mr-1" />
                  Копировать
                </Button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                <code>{envVarsExample}</code>
              </pre>
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Где добавить:</strong> Vercel Dashboard → Settings → Environment Variables
                </AlertDescription>
              </Alert>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Устранение неполадок */}
        <Collapsible open={showTroubleshooting} onOpenChange={setShowTroubleshooting}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {showTroubleshooting ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Устранение неполадок
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      <strong>Ошибка при развертывании:</strong>
                    </p>
                    <p className="text-sm">
                      Если видите ошибку с <code>functions</code> и <code>builds</code>, используйте упрощенный
                      vercel.json:
                    </p>
                    <pre className="text-xs bg-muted p-2 rounded mt-2">
                      <code>{vercelConfigExample}</code>
                    </pre>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm">
                <h6 className="font-semibold">Частые проблемы:</h6>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    • <strong>Бот не отвечает:</strong> Проверьте webhook в диагностике
                  </li>
                  <li>
                    • <strong>Ошибка БД:</strong> Убедитесь, что DATABASE_URL правильный
                  </li>
                  <li>
                    • <strong>Токен бота:</strong> Проверьте формат в переменных окружения
                  </li>
                  <li>
                    • <strong>Логи:</strong> Смотрите в Vercel Dashboard → Functions
                  </li>
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Статус развертывания */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-sm">После успешного развертывания:</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Приложение доступно по HTTPS URL</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Webhook работает с Telegram API</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Бот принимает и отвечает на сообщения</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Система рассылки полностью функциональна</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
