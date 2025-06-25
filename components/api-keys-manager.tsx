"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, Key, Plus, Trash2, Eye, EyeOff, Shield, AlertTriangle, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface ApiKey {
  id: number
  key_name: string
  api_key: string
  permissions: string[]
  is_active: boolean
  last_used_at: string | null
  created_at: string
  expires_at: string | null
}

interface CurrentUser {
  role: string
  name: string
}

export function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set())
  const [accessDenied, setAccessDenied] = useState(false)

  // Форма создания ключа
  const [keyName, setKeyName] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("")

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await fetch("/api/api-keys")
      const data = await response.json()

      if (data.success) {
        setApiKeys(data.apiKeys)
        setCurrentUser(data.currentUser)
        setAccessDenied(false)
      } else {
        if (response.status === 403) {
          setAccessDenied(true)
        } else {
          toast.error(data.error || "Ошибка при загрузке API ключей")
        }
      }
    } catch (error) {
      console.error("Load API keys error:", error)
      toast.error("Ошибка при загрузке API ключей")
    } finally {
      setLoading(false)
    }
  }

  const createApiKey = async () => {
    if (!keyName.trim()) {
      toast.error("Введите название ключа")
      return
    }

    setCreating(true)
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyName: keyName.trim(),
          permissions: ["read_users"],
          expiresInDays: expiresInDays && expiresInDays !== "none" ? Number.parseInt(expiresInDays) : null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("API ключ успешно создан")
        setShowCreateDialog(false)
        setKeyName("")
        setExpiresInDays("")
        loadApiKeys()
        // Автоматически показываем новый ключ
        setTimeout(() => {
          setVisibleKeys(new Set([data.apiKey.id]))
        }, 100)
      } else {
        toast.error(data.error || "Ошибка при создании API ключа")
      }
    } catch (error) {
      console.error("Create API key error:", error)
      toast.error("Ошибка при создании API ключа")
    } finally {
      setCreating(false)
    }
  }

  const deleteApiKey = async (keyId: number) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        toast.success("API ключ удален")
        loadApiKeys()
      } else {
        toast.error(data.error || "Ошибка при удалении API ключа")
      }
    } catch (error) {
      console.error("Delete API key error:", error)
      toast.error("Ошибка при удалении API ключа")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Скопировано в буфер обмена")
  }

  const toggleKeyVisibility = (keyId: number) => {
    const newVisibleKeys = new Set(visibleKeys)
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId)
    } else {
      newVisibleKeys.add(keyId)
    }
    setVisibleKeys(newVisibleKeys)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка API ключей...</p>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>
                <strong>Доступ запрещен.</strong> Управление API ключами доступно только администраторам.
              </span>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              API Ключи
              <Badge variant="outline" className="ml-2">
                <Shield className="h-3 w-3 mr-1" />
                Администратор
              </Badge>
            </CardTitle>
            <CardDescription>
              Управление API ключами для внешнего доступа к данным пользователей
              {currentUser && (
                <span className="block mt-1 text-sm text-muted-foreground">
                  Вы вошли как: <strong>{currentUser.name}</strong>
                </span>
              )}
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Создать API ключ
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Создать новый API ключ
                </DialogTitle>
                <DialogDescription>
                  API ключ позволит получать доступ к данным пользователей через внешние приложения (Power BI, Excel,
                  etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="keyName">Название ключа *</Label>
                  <Input
                    id="keyName"
                    placeholder="Например: Power BI Integration"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="expires">Срок действия</Label>
                  <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Выберите срок действия" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без ограничения</SelectItem>
                      <SelectItem value="30">30 дней</SelectItem>
                      <SelectItem value="90">90 дней</SelectItem>
                      <SelectItem value="365">1 год</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Ключ будет иметь права на чтение данных пользователей с учетом ваших ролевых ограничений.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Отмена
                </Button>
                <Button onClick={createApiKey} disabled={creating || !keyName.trim()}>
                  {creating ? "Создание..." : "Создать ключ"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">У вас пока нет API ключей</h3>
            <p className="text-muted-foreground mb-4">Создайте первый API ключ для интеграции с внешними системами</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать первый ключ
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Всего ключей: <strong>{apiKeys.length}</strong> | Активных:{" "}
                <strong>{apiKeys.filter((key) => key.is_active && !isExpired(key.expires_at)).length}</strong>
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>API Ключ</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Последнее использование</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead>Истекает</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.key_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                          {visibleKeys.has(key.id)
                            ? key.api_key
                            : `${key.api_key.substring(0, 8)}...${key.api_key.substring(key.api_key.length - 4)}`}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => toggleKeyVisibility(key.id)}>
                          {visibleKeys.has(key.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(key.api_key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={key.is_active && !isExpired(key.expires_at) ? "default" : "secondary"}
                        className={
                          key.is_active && !isExpired(key.expires_at)
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : ""
                        }
                      >
                        {key.is_active && !isExpired(key.expires_at) ? "Активен" : "Неактивен"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.last_used_at ? (
                        <span className="text-sm">{formatDate(key.last_used_at)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Никогда</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDate(key.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      {key.expires_at ? (
                        <span className={`text-sm ${isExpired(key.expires_at) ? "text-red-600 font-medium" : ""}`}>
                          {formatDate(key.expires_at)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Никогда</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить API ключ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Это действие нельзя отменить. API ключ <strong>"{key.key_name}"</strong> будет удален
                              навсегда, и все приложения, использующие этот ключ, потеряют доступ к API.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteApiKey(key.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Удалить ключ
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Key className="h-4 w-4" />
            Как использовать API ключ:
          </h4>
          <div className="space-y-3 text-sm">
            <div>
              <strong>URL для Power Query/Excel:</strong>
              <code className="block mt-1 p-2 bg-white rounded border text-xs font-mono">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/users
              </code>
            </div>
            <div>
              <strong>Заголовок авторизации (выберите один):</strong>
              <div className="mt-1 space-y-1">
                <code className="block p-2 bg-white rounded border text-xs font-mono">X-API-Key: ваш_api_ключ</code>
                <code className="block p-2 bg-white rounded border text-xs font-mono">
                  Authorization: Bearer ваш_api_ключ
                </code>
              </div>
            </div>
            <div className="text-xs text-blue-700 mt-2">
              💡 <strong>Совет:</strong> В Power Query используйте "Веб" → "Дополнительно" → добавьте заголовок
              X-API-Key
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
