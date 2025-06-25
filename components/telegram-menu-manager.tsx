"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Menu, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BotCommand {
  command: string
  description: string
}

export function TelegramMenuManager() {
  const [commands, setCommands] = useState<BotCommand[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  const loadCommands = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/telegram-menu")
      const data = await response.json()

      if (data.success) {
        setCommands(data.commands || [])
        toast({
          title: "✅ Команды загружены",
          description: `Найдено ${data.commands?.length || 0} команд`,
        })
      } else {
        throw new Error(data.error || "Failed to load commands")
      }
    } catch (error) {
      console.error("Error loading commands:", error)
      toast({
        title: "❌ Ошибка загрузки",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateMenu = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch("/api/telegram-menu", {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        toast({
          title: "✅ Меню обновлено",
          description: "Команды бота успешно установлены",
        })
        // Перезагружаем команды
        await loadCommands()
      } else {
        throw new Error(data.error || "Failed to update menu")
      }
    } catch (error) {
      console.error("Error updating menu:", error)
      toast({
        title: "❌ Ошибка обновления",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Menu className="h-5 w-5" />
          Меню команд Telegram бота
        </CardTitle>
        <CardDescription>Управление командами, которые отображаются в меню бота</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={loadCommands} disabled={isLoading} variant="outline">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Загрузить команды
          </Button>

          <Button onClick={updateMenu} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Menu className="h-4 w-4 mr-2" />}
            Обновить меню
          </Button>
        </div>

        {commands.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Текущие команды:</h4>
            <div className="space-y-2">
              {commands.map((command, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">/{command.command}</Badge>
                    <span className="text-sm text-muted-foreground">{command.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Доступные команды:</strong>
          </p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>
              <code>/start</code> - Начать работу с ботом / Регистрация
            </li>
            <li>
              <code>/toroute</code> - Построить маршрут между точками
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
