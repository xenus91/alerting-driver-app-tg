"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bot, Settings, RefreshCw, CheckCircle, AlertCircle, MessageSquare, Command, Send } from "lucide-react"

interface BotInfo {
  success: boolean
  botInfo?: {
    id: number
    is_bot: boolean
    first_name: string
    username: string
    can_join_groups: boolean
    can_read_all_group_messages: boolean
    supports_inline_queries: boolean
  }
  commands?: Array<{
    command: string
    description: string
  }>
  description?: {
    description: string
  }
  botUsername?: string
}

export default function BotSetup() {
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<any>(null)

  const [description, setDescription] = useState("")
  const [shortDescription, setShortDescription] = useState("")

  const fetchBotInfo = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/bot-setup")
      const data = await response.json()
      setBotInfo(data)

      if (data.description?.description) {
        setDescription(data.description.description)
      }
    } catch (error) {
      console.error("Error fetching bot info:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateBotDescription = async () => {
    setIsUpdating(true)
    setUpdateResult(null)
    try {
      const response = await fetch("/api/bot-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setDescription",
          description,
          shortDescription,
        }),
      })
      const data = await response.json()
      setUpdateResult(data)

      if (data.success) {
        setTimeout(fetchBotInfo, 1000)
      }
    } catch (error) {
      setUpdateResult({
        success: false,
        error: "Ошибка при обновлении описания",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const setupCommands = async () => {
    setIsUpdating(true)
    setUpdateResult(null)
    try {
      const response = await fetch("/api/bot-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setCommands",
        }),
      })
      const data = await response.json()
      setUpdateResult(data)

      if (data.success) {
        setTimeout(fetchBotInfo, 1000)
      }
    } catch (error) {
      setUpdateResult({
        success: false,
        error: "Ошибка при установке команд",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    fetchBotInfo()
  }, [])

  const botUsername = botInfo?.botUsername || botInfo?.botInfo?.username

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Настройка бота
          </CardTitle>
          <CardDescription>Управление описанием и командами бота</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Загрузка информации о боте...
            </div>
          ) : (
            <>
              {/* Информация о боте */}
              {botInfo?.botInfo && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Информация о боте:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Имя:</span>
                      <span className="ml-2 font-medium">{botInfo.botInfo.first_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Username:</span>
                      <span className="ml-2 font-medium">@{botInfo.botInfo.username}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ID:</span>
                      <span className="ml-2 font-mono">{botInfo.botInfo.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Статус:</span>
                      <Badge variant="default" className="ml-2">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Активен
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Кнопка запуска бота */}
              {botUsername && (
                <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-green-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">🚀 Запустить бота</h4>
                      <p className="text-sm text-muted-foreground">
                        Нажмите кнопку ниже, чтобы открыть бота в Telegram
                      </p>
                    </div>
                    <Button size="lg" asChild className="bg-blue-600 hover:bg-blue-700">
                      <a href={`https://t.me/${botUsername}?start=welcome`} target="_blank" rel="noopener noreferrer">
                        <Send className="h-4 w-4 mr-2" />
                        Открыть бота
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Редактирование описания */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="short-description">Короткое описание</Label>
                  <Input
                    id="short-description"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="🚗 Система управления рейсами для водителей"
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Отображается в поиске ботов (максимум 120 символов)
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">Полное описание</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Введите описание бота..."
                    rows={6}
                    maxLength={512}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Отображается при первом запуске бота (максимум 512 символов)
                  </p>
                </div>

                <Button onClick={updateBotDescription} disabled={isUpdating} className="w-full">
                  {isUpdating ? (
                    <>
                      <Settings className="mr-2 h-4 w-4 animate-spin" />
                      Обновление описания...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Обновить описание
                    </>
                  )}
                </Button>
              </div>

              {/* Команды бота */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Команды бота</h4>
                  <Button variant="outline" size="sm" onClick={setupCommands} disabled={isUpdating}>
                    {isUpdating ? <Settings className="h-3 w-3 animate-spin" /> : <Command className="h-3 w-3" />}
                  </Button>
                </div>

                {botInfo?.commands && botInfo.commands.length > 0 ? (
                  <div className="space-y-1">
                    {botInfo.commands.map((cmd, index) => (
                      <div key={index} className="flex justify-between text-sm p-2 bg-muted rounded">
                        <code>/{cmd.command}</code>
                        <span className="text-muted-foreground">{cmd.description}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Команды не настроены</p>
                )}
              </div>

              {/* Результат обновления */}
              {updateResult && (
                <Alert variant={updateResult.success ? "default" : "destructive"}>
                  {updateResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription>
                    {updateResult.success ? updateResult.message : updateResult.error}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
