"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Command, RefreshCw, CheckCircle, AlertCircle, Trash2, Plus, Settings, Bot, List } from "lucide-react"

interface TelegramCommand {
  command: string
  description: string
}

interface CommandsResponse {
  success: boolean
  commands?: TelegramCommand[]
  message?: string
  error?: string
}

export default function TelegramCommandsManager() {
  const [currentCommands, setCurrentCommands] = useState<TelegramCommand[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [customCommands, setCustomCommands] = useState(`[
  {
    "command": "start",
    "description": "🚀 Начать работу с ботом"
  },
  {
    "command": "toroute",
    "description": "🗺️ Построить маршрут между точками"
  },
  {
    "command": "status",
    "description": "📊 Проверить статус регистрации"
  },
  {
    "command": "help",
    "description": "❓ Получить справку"
  }
]`)

  const fetchCurrentCommands = async () => {
    setIsLoading(true)
    setResult(null)
    try {
      const response = await fetch("/api/get-telegram-commands")
      const data: CommandsResponse = await response.json()

      if (data.success && data.commands) {
        setCurrentCommands(data.commands)
        setResult({
          success: true,
          message: `Загружено ${data.commands.length} команд`,
          type: "fetch",
        })
      } else {
        setCurrentCommands([])
        setResult({
          success: false,
          message: data.error || "Ошибка при загрузке команд",
          type: "fetch",
        })
      }
    } catch (error) {
      console.error("Error fetching commands:", error)
      setCurrentCommands([])
      setResult({
        success: false,
        message: "Ошибка при загрузке команд",
        type: "fetch",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteAllCommands = async () => {
    setIsDeleting(true)
    setResult(null)
    try {
      const response = await fetch("/api/delete-telegram-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      setResult({
        success: data.success,
        message: data.success ? "Все команды удалены" : data.error,
        type: "delete",
      })

      if (data.success) {
        setCurrentCommands([])
        // Обновляем список через секунду
        setTimeout(fetchCurrentCommands, 1000)
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Ошибка при удалении команд",
        type: "delete",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const setCommands = async (force = false) => {
    setIsUpdating(true)
    setResult(null)
    try {
      let commands: TelegramCommand[]
      try {
        commands = JSON.parse(customCommands)
      } catch (e) {
        setResult({
          success: false,
          message: "Неверный формат JSON команд",
          type: "set",
        })
        setIsUpdating(false)
        return
      }

      const response = await fetch("/api/set-telegram-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, commands }),
      })
      const data = await response.json()

      setResult({
        success: data.success,
        message: data.success ? `Команды установлены${force ? " (принудительно)" : ""}` : data.error,
        type: "set",
      })

      if (data.success) {
        // Обновляем список через секунду
        setTimeout(fetchCurrentCommands, 1000)
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Ошибка при установке команд",
        type: "set",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const resetToDefault = () => {
    setCustomCommands(`[
  {
    "command": "start",
    "description": "🚀 Начать работу с ботом"
  },
  {
    "command": "toroute",
    "description": "🗺️ Построить маршрут между точками"
  },
  {
    "command": "status",
    "description": "📊 Проверить статус регистрации"
  },
  {
    "command": "help",
    "description": "❓ Получить справку"
  }
]`)
  }

  useEffect(() => {
    fetchCurrentCommands()
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Управление командами Telegram бота
          </CardTitle>
          <CardDescription>Просмотр, удаление и установка команд для меню бота</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Текущие команды */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <List className="h-4 w-4" />
                Текущие команды бота
              </h4>
              <Button variant="outline" size="sm" onClick={fetchCurrentCommands} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-4 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Загрузка команд...
              </div>
            ) : currentCommands.length > 0 ? (
              <div className="space-y-2">
                {currentCommands.map((cmd, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="font-mono">
                        /{cmd.command}
                      </Badge>
                      <span className="text-sm">{cmd.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 text-muted-foreground bg-muted/50 rounded-lg">
                Команды не найдены или не установлены
              </div>
            )}
          </div>

          <Separator />

          {/* Управление командами */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Управление командами
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="destructive"
                onClick={deleteAllCommands}
                disabled={isDeleting || isUpdating}
                className="w-full"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить все команды
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setCommands(true)}
                disabled={isUpdating || isDeleting}
                className="w-full"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Обновление...
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" />
                    Принудительно обновить
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Настройка команд */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Настройка команд
              </h4>
              <Button variant="ghost" size="sm" onClick={resetToDefault}>
                Сбросить к умолчанию
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commands-json">JSON конфигурация команд</Label>
              <Textarea
                id="commands-json"
                value={customCommands}
                onChange={(e) => setCustomCommands(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Введите JSON массив команд..."
              />
              <p className="text-xs text-muted-foreground">
                Формат: массив объектов с полями "command" и "description"
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={() => setCommands(false)} disabled={isUpdating || isDeleting} className="w-full">
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Установка...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Установить команды
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setCommands(true)}
                disabled={isUpdating || isDeleting}
                className="w-full"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Установка...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Принудительная установка
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Результат операции */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>{result.message}</span>
                  <Badge variant="outline" className="text-xs">
                    {result.type}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
