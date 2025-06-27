"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, AlertTriangle, Info } from "lucide-react"

interface SimpleLoginProps {
  onSuccess: (user: any) => void
}

export default function SimpleLogin({ onSuccess }: SimpleLoginProps) {
  const [telegramId, setTelegramId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!telegramId.trim()) {
      setError("Введите ваш Telegram ID")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Создаем фиктивные данные для авторизации
      const fakeAuthData = {
        id: Number.parseInt(telegramId),
        first_name: "Оператор",
        username: "operator",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "fake_hash_for_development",
      }

      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fakeAuthData),
      })

      const data = await response.json()

      if (data.success) {
        onSuccess(data.user)
      } else {
        setError(data.error || "Ошибка авторизации")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Ошибка подключения к серверу")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Временный вход</CardTitle>
          <CardDescription>Введите ваш Telegram ID для входа в систему</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">


          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-id">Telegram ID</Label>
              <Input
                id="telegram-id"
                type="number"
                placeholder="Например: 123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Вход...
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </form>

          <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
            <p>
              <strong>Как узнать свой Telegram ID:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Напишите боту @userinfobot в Telegram</li>
              <li>Он пришлет ваш ID (например: 123456789)</li>
              <li>Введите этот номер в поле выше</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
