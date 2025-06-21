"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, Users, AlertTriangle } from "lucide-react"

declare global {
  interface Window {
    Telegram?: {
      // Объект Telegram верхнего уровня
      Login?: {
        // Модуль логина
        auth: (options: Record<string, any>, callback: (dataOrError: any) => void) => void
      }
      Widgets?: {
        // Альтернативное место для виджетов
        Login: (element: HTMLElement, options: Record<string, any>) => void
      }
    }
    TelegramLoginWidget?: {
      // Старый способ
      dataOnauth: (user: any) => void
    }
    onTelegramAuthGlobal?: (user: any) => void
  }
}

interface TelegramLoginProps {
  onSuccess: (user: any) => void
}

export default function TelegramLogin({ onSuccess }: TelegramLoginProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scriptLoadStatus, setScriptLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const widgetContainerRef = useRef<HTMLDivElement>(null) // Ссылка на контейнер, куда вставлять виджет

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME

  useEffect(() => {
    if (!botUsername) {
      console.error("❌ NEXT_PUBLIC_BOT_USERNAME не установлен!")
      setError("Критическая ошибка: Имя бота не настроено. Обратитесь к администратору.")
      setScriptLoadStatus("error")
      return
    }

    console.log("ℹ️ Попытка загрузки виджета Telegram для бота:", botUsername)
    setScriptLoadStatus("loading")

    const existingScript = document.querySelector('script[src^="https://telegram.org/js/telegram-widget.js"]')
    if (existingScript) {
      console.log("ℹ️ Скрипт Telegram уже существует, удаляем старый.")
      existingScript.remove()
      delete window.onTelegramAuthGlobal // Удаляем старый обработчик
      delete window.TelegramLoginWidget
      delete window.Telegram
    }

    const script = document.createElement("script")
    script.id = "telegram-login-script" // Дадим ID для простоты поиска
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    // Атрибуты для автоматической инициализации, если она сработает
    script.setAttribute("data-telegram-login", botUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "10")
    script.setAttribute("data-request-access", "write")
    script.setAttribute("data-userpic", "false")
    script.setAttribute("data-onauth", "onTelegramAuthGlobal")
    script.async = true
    script.defer = true

    script.onload = () => {
      console.log("✅ Скрипт Telegram виджета успешно загружен.")
      setScriptLoadStatus("loaded")
      if (widgetContainerRef.current) {
        // Проверяем, появился ли виджет автоматически
        if (widgetContainerRef.current.querySelector('iframe[src^="https://oauth.telegram.org"]')) {
          console.log("ℹ️ Виджет Telegram автоматически инициализирован через data-атрибуты.")
        } else if (window.Telegram && window.Telegram.Widgets && widgetContainerRef.current) {
          // Попытка ручной инициализации, если автоматическая не сработала
          // и если Telegram.Widgets.Login доступен
          console.warn(
            "⚠️ Автоматическая инициализация виджета не удалась. Попытка ручной инициализации через window.Telegram.Widgets.Login.",
          )
          try {
            // Очищаем контейнер перед добавлением нового виджета
            widgetContainerRef.current.innerHTML = ""
            const loginButtonElement = document.createElement("div") // Telegram может сам создать кнопку
            widgetContainerRef.current.appendChild(loginButtonElement)

            window.Telegram.Widgets.Login(loginButtonElement, {
              bot: botUsername,
              size: "large",
              radius: "10",
              request_access: "write",
              userpic: false,
              onAuth: (user: any) => window.onTelegramAuthGlobal?.(user), // Используем наш глобальный обработчик
            })
            console.log("ℹ️ Ручная инициализация виджета Telegram предпринята.")
          } catch (e) {
            console.error("❌ Ошибка при ручной инициализации виджета Telegram:", e)
            setError("Не удалось инициализировать виджет Telegram. Попробуйте обновить страницу.")
          }
        } else {
          console.warn(
            "⚠️ window.TelegramLoginWidget или window.Telegram.Widgets.Login не определены после загрузки скрипта. Кнопка не будет отображена.",
          )
          // setError("Не удалось отобразить кнопку входа Telegram. Проверьте настройки домена в BotFather и консоль браузера.");
        }
      } else {
        console.error("❌ Контейнер для виджета не найден (widgetContainerRef.current is null).")
      }
    }

    script.onerror = (e) => {
      console.error("❌ Ошибка загрузки скрипта Telegram виджета:", e)
      setError(
        "Не удалось загрузить виджет авторизации Telegram. Проверьте подключение к интернету и настройки браузера.",
      )
      setScriptLoadStatus("error")
    }

    document.head.appendChild(script)

    if (!window.onTelegramAuthGlobal) {
      window.onTelegramAuthGlobal = async (user: any) => {
        console.log("ℹ️ Получены данные от Telegram:", user)
        setIsLoading(true)
        setError(null)
        try {
          const response = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user),
          })
          const data = await response.json()
          if (data.success) {
            console.log("✅ Авторизация через API успешна:", data.user)
            onSuccess(data.user)
          } else {
            console.error("❌ Ошибка авторизации через API:", data.error)
            setError(data.error || "Ошибка авторизации")
          }
        } catch (err) {
          console.error("❌ Критическая ошибка при запросе к API авторизации:", err)
          setError("Ошибка подключения к серверу авторизации")
        } finally {
          setIsLoading(false)
        }
      }
    }

    return () => {
      console.log("ℹ️ Очистка скрипта Telegram виджета.")
      const existingScript = document.getElementById("telegram-login-script")
      if (existingScript) existingScript.remove()
      delete window.onTelegramAuthGlobal
      delete window.TelegramLoginWidget
      delete window.Telegram // Очищаем и объект Telegram
    }
  }, [botUsername, onSuccess])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Вход в систему</CardTitle>
          <CardDescription>Войдите через Telegram для доступа к панели управления</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!botUsername && scriptLoadStatus === "error" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Критическая ошибка: Имя бота не настроено.</AlertDescription>
            </Alert>
          )}

          <div
            ref={widgetContainerRef}
            id="telegram-login-widget-container"
            className="text-center min-h-[70px] flex items-center justify-center"
          >
            {scriptLoadStatus === "loading" && (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Загрузка виджета Telegram...
              </div>
            )}
            {scriptLoadStatus === "error" && !error && (
              <div className="text-red-600">Не удалось загрузить виджет Telegram.</div>
            )}
            {scriptLoadStatus === "loaded" && !widgetContainerRef.current?.querySelector("iframe") && (
              <div className="text-orange-600 p-2 text-sm">
                Скрипт Telegram загружен, но кнопка входа не отобразилась. <br />
                Убедитесь, что домен правильно указан в настройках вашего бота в @BotFather и совпадает с текущим
                адресом сайта.
              </div>
            )}
            {/* Виджет Telegram должен быть вставлен сюда скриптом */}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Авторизация...
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Доступ к панели управления только для операторов.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
