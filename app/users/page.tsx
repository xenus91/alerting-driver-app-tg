"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Users, Search, Phone, Calendar, ExternalLink } from "lucide-react"

interface UserInterface {
  id: number
  telegram_id: number
  phone: string
  name: string
  first_name:string
  las_name:string
  carpark:string
  role:string
  verified: boolean
  registration_state:string 
  full_name: string
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserInterface[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserInterface[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        setFilteredUsers(data.users)
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phone.includes(searchTerm) ||
          user.telegram_id.toString().includes(searchTerm),
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchTerm, users])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const formatPhone = (phone: string) => {
    // Форматируем номер как +7 (XXX) XXX-XX-XX
    if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`
    }
    return phone
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Зарегистрированные пользователи</h1>
          <p className="text-muted-foreground">Пользователи, которые зарегистрировались в Telegram боте</p>
        </div>
        <Button onClick={fetchUsers} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Зарегистрированных в системе</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Новые за сегодня</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                users.filter((user) => {
                  const today = new Date()
                  const userDate = new Date(user.created_at)
                  return userDate.toDateString() === today.toDateString()
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground">Регистраций сегодня</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активность</CardTitle>
            <Badge variant="default" className="bg-green-600">
              Активно
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground">Пользователи доступны</p>
          </CardContent>
        </Card>
      </div>

      {/* Поиск */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Поиск пользователей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени, номеру телефона или Telegram ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Список пользователей */}
      <Card>
        <CardHeader>
          <CardTitle>
            Пользователи ({filteredUsers.length}
            {searchTerm && ` из ${users.length}`})
          </CardTitle>
          <CardDescription>
            {searchTerm ? `Результаты поиска для "${searchTerm}"` : "Все зарегистрированные пользователи"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Загрузка пользователей...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              {searchTerm ? (
                <div>
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Пользователи не найдены</p>
                  <p className="text-sm text-muted-foreground">Попробуйте изменить поисковый запрос</p>
                </div>
              ) : (
                <div>
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Пользователи не найдены</p>
                  <p className="text-sm text-muted-foreground">Пользователи появятся здесь после регистрации в боте</p>
                  {process.env.NEXT_PUBLIC_BOT_USERNAME && (
                    <Button variant="outline" size="sm" className="mt-4" asChild>
                      <a
                        href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Открыть бота
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {formatPhone(user.phone)}
                        </div>
                        <div>ID: {user.telegram_id}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">Активен</Badge>
                    <div className="text-xs text-muted-foreground mt-1">Регистрация: {formatDate(user.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Инструкции */}
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          <strong>Как пользователи регистрируются:</strong>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>Пользователь находит вашего бота в Telegram</li>
            <li>Отправляет команду /start</li>
            <li>Делится своим номером телефона через кнопку</li>
            <li>Система автоматически сохраняет данные пользователя</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  )
}
