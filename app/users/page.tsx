"use client"

import { useState, useEffect, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import {
  RefreshCw,
  Users,
  Phone,
  Calendar,
  ExternalLink,
  Edit,
  Save,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Trash2,
} from "lucide-react"

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
  verified: boolean
}

interface CurrentUser {
  role: string
  carpark: string
}

const columnHelper = createColumnHelper<UserInterface>()

export default function UsersPage() {
  const [users, setUsers] = useState<UserInterface[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [globalFilter, setGlobalFilter] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [userToDelete, setUserToDelete] = useState<UserInterface | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        setCurrentUser(data.currentUser)
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
      awaiting_first_name: "Ожидание имени и отчества",
      awaiting_last_name: "Ожидание фамилии",
      awaiting_carpark: "Ожидание автохозяйства",
      completed: "Завершена",
    }
    return translations[state] || state
  }

  const handleEditUser = (user: UserInterface) => {
    setEditingUser({
      id: user.id,
      name: user.name || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      carpark: user.carpark || "",
      role: user.role || "",
      verified: user.verified || false,
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
        alert(`Ошибка при обновлении пользователя: ${data.error}`)
      }
    } catch (error) {
      console.error("Error updating user:", error)
      alert("Ошибка при обновлении пользователя")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (data.success) {
        await fetchUsers()
        setUserToDelete(null)
      } else {
        alert(`Ошибка при удалении пользователя: ${data.error}`)
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Ошибка при удалении пользователя")
    } finally {
      setIsDeleting(false)
    }
  }

  const isAdmin = currentUser?.role === "admin"

  const columns = useMemo(
    () => [
      columnHelper.accessor("full_name", {
        header: "Пользователь",
        cell: (info) => {
          const user = info.row.original
          return (
            <div>
              <div className="font-medium">{user.full_name || user.name || "Неизвестный"}</div>
              {user.first_name && user.last_name && (
                <div className="text-xs text-muted-foreground">
                  {user.first_name} {user.last_name}
                </div>
              )}
            </div>
          )
        },
        filterFn: (row, columnId, value) => {
          const user = row.original
          const searchText = (user.full_name || user.name || user.first_name || user.last_name || "").toLowerCase()
          return searchText.includes(value.toLowerCase())
        },
      }),
      columnHelper.accessor("phone", {
        header: "Телефон",
        cell: (info) => (
          <div className="flex items-center">
            <Phone className="h-3 w-3 mr-1" />
            {formatPhone(info.getValue())}
          </div>
        ),
      }),
      columnHelper.accessor("telegram_id", {
        header: "Telegram ID",
        cell: (info) => <span className="font-mono text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor("carpark", {
        header: "Автопарк",
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("role", {
        header: "Роль",
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("verified", {
        header: "Верификация",
        cell: (info) => (
          <Badge variant={info.getValue() ? "default" : "destructive"}>
            {info.getValue() ? "Верифицирован" : "Не верифицирован"}
          </Badge>
        ),
        filterFn: (row, columnId, value) => {
          if (value === "verified") return row.original.verified
          if (value === "not_verified") return !row.original.verified
          return true
        },
      }),
      columnHelper.accessor("registration_state", {
        header: "Состояние",
        cell: (info) => <Badge variant="outline">{translateRegistrationState(info.getValue())}</Badge>,
        filterFn: (row, columnId, value) => {
          return translateRegistrationState(row.original.registration_state).toLowerCase().includes(value.toLowerCase())
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Регистрация",
        cell: (info) => <span className="text-xs text-muted-foreground">{formatDate(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "Действия",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleEditUser(info.row.original)}>
              <Edit className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUserToDelete(info.row.original)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      }),
    ],
    [isAdmin],
  )

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const user = row.original
      const searchableText = [
        user.full_name || user.name || "",
        user.first_name || "",
        user.last_name || "",
        user.phone || "",
        user.telegram_id?.toString() || "",
        user.carpark || "",
        user.role || "",
        user.verified ? "верифицирован" : "не верифицирован",
        translateRegistrationState(user.registration_state),
      ]
        .join(" ")
        .toLowerCase()

      return searchableText.includes(filterValue.toLowerCase())
    },
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  const getSortIcon = (isSorted: false | "asc" | "desc") => {
    if (isSorted === "asc") return <ArrowUp className="h-3 w-3" />
    if (isSorted === "desc") return <ArrowDown className="h-3 w-3" />
    return <ArrowUpDown className="h-3 w-3" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Зарегистрированные пользователи</h1>
          <p className="text-muted-foreground">
            {currentUser?.role === "operator"
              ? `Водители автопарка ${currentUser.carpark}`
              : "Пользователи, которые зарегистрировались в Telegram боте"}
          </p>
        </div>
        <div className="flex gap-2">
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Пользователи ({table.getFilteredRowModel().rows.length}
                {globalFilter && ` из ${users.length}`})
              </CardTitle>
              <CardDescription>
                {globalFilter ? "Результаты поиска" : "Все зарегистрированные пользователи"}
              </CardDescription>
            </div>
            {globalFilter && (
              <Button variant="outline" size="sm" onClick={() => setGlobalFilter("")}>
                <X className="h-4 w-4 mr-1" />
                Очистить поиск
              </Button>
            )}
          </div>

          {/* Глобальный поиск */}
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по всем полям..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Загрузка пользователей...
            </div>
          ) : table.getFilteredRowModel().rows.length === 0 ? (
            <div className="text-center py-8">
              {globalFilter ? (
                <div>
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : (
                            <div
                              className={`flex items-center gap-2 ${
                                header.column.getCanSort() ? "cursor-pointer select-none" : ""
                              }`}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && getSortIcon(header.column.getIsSorted())}
                            </div>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
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
              Изменение данных пользователя.
              {!isAdmin && ' Поле "Верифицирован" недоступно для редактирования.'}
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
              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="verified"
                    checked={editingUser.verified}
                    onCheckedChange={(checked) => setEditingUser({ ...editingUser, verified: checked })}
                  />
                  <Label htmlFor="verified">Верифицирован</Label>
                </div>
              )}
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

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление пользователя</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить пользователя{" "}
              <strong>{userToDelete?.full_name || userToDelete?.name}</strong>?
              <br />
              <br />
              Это действие нельзя отменить. Будут удалены:
              <ul className="list-disc list-inside mt-2">
                <li>Данные пользователя</li>
                <li>Все сессии пользователя</li>
                <li>Ожидающие действия</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Удалить
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
