"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RefreshCw, Users, Phone, Calendar, ExternalLink, Edit, Save, X, ChevronDown } from "lucide-react"

interface UserInterface {
  id: number
  telegram_id: number
  phone: string
  name: string
  first_name: string
  last_name: string
  carpark: string
  role: string
  verified: boolean
  registration_state: string
  full_name: string
  created_at: string
}

interface EditingUser {
  id: number
  name: string
  first_name: string
  last_name: string
  carpark: string
  role: string
}

interface ColumnFilters {
  name: string
  phone: string
  telegram_id: string
  carpark: string
  role: string
  verified: string
  registration_state: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserInterface[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserInterface[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Фильтры для колонок
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    name: "",
    phone: "",
    telegram_id: "",
    carpark: "",
    role: "",
    verified: "",
    registration_state: "",
  })

  // Состояния открытых поповеров
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({})

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
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

  // Применение фильтров
  useEffect(() => {
    let filtered = users

    // Фильтр по имени
    if (columnFilters.name) {
      filtered = filtered.filter((user) =>
        (user.full_name || user.name || "").toLowerCase().includes(columnFilters.name.toLowerCase()),
      )
    }

    // Фильтр по телефону
    if (columnFilters.phone) {
      filtered = filtered.filter((user) => user.phone.includes(columnFilters.phone))
    }

    // Фильтр по Telegram ID
    if (columnFilters.telegram_id) {
      filtered = filtered.filter((user) => user.telegram_id.toString().includes(columnFilters.telegram_id))
    }

    // Фильтр по автопарку
    if (columnFilters.carpark) {
      filtered = filtered.filter((user) =>
        (user.carpark || "").toLowerCase().includes(columnFilters.carpark.toLowerCase()),
      )
    }

    // Фильтр по роли
    if (columnFilters.role) {
      filtered = filtered.filter((user) => (user.role || "").toLowerCase().includes(columnFilters.role.toLowerCase()))
    }

    // Фильтр по верификации
    if (columnFilters.verified) {
      filtered = filtered.filter((user) => (columnFilters.verified === "verified" ? user.verified : !user.verified))
    }

    // Фильтр по состоянию регистрации
    if (columnFilters.registration_state) {
      filtered = filtered.filter((user) => user.registration_state === columnFilters.registration_state)
    }

    setFilteredUsers(filtered)
  }, [users, columnFilters])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`
    }
    return phone
  }

  const translateRegistrationState = (state: string) => {
    const translations: Record<string, string> = {
      pending: "Ожидает",
      completed: "Завершена",
      verified: "Верифицирован",
      active: "Активен",
      inactive: "Неактивен",
      blocked: "Заблокирован",
      new: "Новый",
      registered: "Зарегистрирован",
    }
    return translations[state] || state
  }

  const getUniqueValues = (field: keyof UserInterface) => {
    return [...new Set(users.map((user) => user[field]).filter(Boolean))].sort()
  }

  const handleEditUser = (user: UserInterface) => {
    setEditingUser({
      id: user.id,
      name: user.name || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      carpark: user.carpark || "",
      role: user.role || "",
    })
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingUser),
      })

      const data = await response.json()
      if (data.success) {
        await fetchUsers()
        setEditingUser(null)
      } else {
        alert("Ошибка при обновлении пользователя")
      }
    } catch (error) {
      console.error("Error updating user:", error)
      alert("Ошибка при обновлении пользователя")
    } finally {
      setIsUpdating(false)
    }
  }

  const updateColumnFilter = (column: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [column]: value }))
  }

  const clearAllFilters = () => {
    setColumnFilters({
      name: "",
      phone: "",
      telegram_id: "",
      carpark: "",
      role: "",
      verified: "",
      registration_state: "",
    })
  }

  const hasActiveFilters = Object.values(columnFilters).some((filter) => filter !== "")

  const togglePopover = (column: string) => {
    setOpenPopovers((prev) => ({ ...prev, [column]: !prev[column] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Зарегистрированные пользователи</h1>
          <p className="text-muted-foreground">Пользователи, которые зарегистрировались в Telegram боте</p>
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              Очистить фильтры
            </Button>
          )}
          <Button onClick={fetchUsers} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Верифицированные</CardTitle>
            <Badge variant="default" className="bg-green-600">
              Активно
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((user) => user.verified).length}</div>
            <p className="text-xs text-muted-foreground">Подтвержденные номера</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Не верифицированные</CardTitle>
            <Badge variant="destructive">Требуют внимания</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((user) => !user.verified).length}</div>
            <p className="text-xs text-muted-foreground">Неподтвержденные номера</p>
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
      </div>

      {/* Таблица пользователей */}
      <Card>
        <CardHeader>
          <CardTitle>
            Пользователи ({filteredUsers.length}
            {hasActiveFilters && ` из ${users.length}`})
          </CardTitle>
          <CardDescription>
            {hasActiveFilters ? "Отфильтрованные пользователи" : "Все зарегистрированные пользователи"}
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
              {hasActiveFilters ? (
                <div>
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Пользователи не найдены</p>
                  <p className="text-sm text-muted-foreground">Попробуйте изменить фильтры</p>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Пользователь
                        <Popover open={openPopovers.name} onOpenChange={() => togglePopover("name")}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Поиск по имени</Label>
                              <Input
                                placeholder="Введите имя..."
                                value={columnFilters.name}
                                onChange={(e) => updateColumnFilter("name", e.target.value)}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Телефон
                        <Popover open={openPopovers.phone} onOpenChange={() => togglePopover("phone")}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Поиск по телефону</Label>
                              <Input
                                placeholder="Введите номер..."
                                value={columnFilters.phone}
                                onChange={(e) => updateColumnFilter("phone", e.target.value)}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Telegram ID
                        <Popover open={openPopovers.telegram_id} onOpenChange={() => togglePopover("telegram_id")}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Поиск по ID</Label>
                              <Input
                                placeholder="Введите ID..."
                                value={columnFilters.telegram_id}
                                onChange={(e) => updateColumnFilter("telegram_id", e.target.value)}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Автопарк
                        <Popover open={openPopovers.carpark} onOpenChange={() => togglePopover("carpark")}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Фильтр по автопарку</Label>
                              <Select
                                value={columnFilters.carpark}
                                onValueChange={(value) => updateColumnFilter("carpark", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Выберите автопарк" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Все</SelectItem>
                                  {getUniqueValues("carpark").map((carpark) => (
                                    <SelectItem key={carpark} value={carpark}>
                                      {carpark}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Роль
                        <Popover open={openPopovers.role} onOpenChange={() => togglePopover("role")}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Фильтр по роли</Label>
                              <Select
                                value={columnFilters.role}
                                onValueChange={(value) => updateColumnFilter("role", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Выберите роль" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Все</SelectItem>
                                  {getUniqueValues("role").map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Верификация
                        <Popover open={openPopovers.verified} onOpenChange={() => togglePopover("verified")}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Фильтр по верификации</Label>
                              <Select
                                value={columnFilters.verified}
                                onValueChange={(value) => updateColumnFilter("verified", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Все" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Все</SelectItem>
                                  <SelectItem value="verified">Верифицированные</SelectItem>
                                  <SelectItem value="not_verified">Не верифицированные</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Состояние
                        <Popover
                          open={openPopovers.registration_state}
                          onOpenChange={() => togglePopover("registration_state")}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-2">
                              <Label>Фильтр по состоянию</Label>
                              <Select
                                value={columnFilters.registration_state}
                                onValueChange={(value) => updateColumnFilter("registration_state", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Все" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Все</SelectItem>
                                  {getUniqueValues("registration_state").map((state) => (
                                    <SelectItem key={state} value={state}>
                                      {translateRegistrationState(state)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead>Регистрация</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name || user.name || "Неизвестный"}</div>
                          {user.first_name && user.last_name && (
                            <div className="text-xs text-muted-foreground">
                              {user.first_name} {user.last_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {formatPhone(user.phone)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.telegram_id}</TableCell>
                      <TableCell>{user.carpark || "—"}</TableCell>
                      <TableCell>{user.role || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={user.verified ? "default" : "destructive"}>
                          {user.verified ? "Верифицирован" : "Не верифицирован"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{translateRegistrationState(user.registration_state)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог редактирования */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование пользователя</DialogTitle>
            <DialogDescription>
              Изменение данных пользователя. Поле "Верифицирован" недоступно для редактирования.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Имя пользователя</Label>
                <Input
                  id="name"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="first_name">Имя</Label>
                <Input
                  id="first_name"
                  value={editingUser.first_name}
                  onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Фамилия</Label>
                <Input
                  id="last_name"
                  value={editingUser.last_name}
                  onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="carpark">Автопарк</Label>
                <Input
                  id="carpark"
                  value={editingUser.carpark}
                  onChange={(e) => setEditingUser({ ...editingUser, carpark: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Роль</Label>
                <Input
                  id="role"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Отмена
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <li>Администратор может верифицировать пользователя вручную</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  )
}
