"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Clock,
  AlertCircle,
  Hash,
  Search,
  Filter,
  ArrowUpDown,
  Navigation,
} from "lucide-react"
import { YandexMap } from "@/components/yandex-map"

interface Point {
  id: number
  point_id: string
  point_name: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: string // Теперь без пробела!
  longitude?: string
  adress?: string
  created_at: string
  updated_at: string
}

type SortField = "point_id" | "point_name" | "created_at" | "updated_at"
type SortDirection = "asc" | "desc"

export default function PointsPage() {
  const [points, setPoints] = useState<Point[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<Point | null>(null)
  const [formData, setFormData] = useState({
    point_id: "",
    point_name: "",
    door_open_1: "",
    door_open_2: "",
    door_open_3: "",
    latitude: "",
    longitude: "",
    adress: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Фильтрация и сортировка
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("point_id")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [hasCoordinatesFilter, setHasCoordinatesFilter] = useState<string>("all")

  const fetchPoints = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/points")
      const data = await response.json()
      if (data.success) {
        setPoints(data.points)
      }
    } catch (error) {
      console.error("Error fetching points:", error)
      setError("Ошибка при загрузке пунктов")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPoints()
  }, [])

  // Фильтрованные и отсортированные пункты
  const filteredAndSortedPoints = useMemo(() => {
    const filtered = points.filter((point) => {
      const matchesSearch =
        point.point_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        point.point_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (point.adress && point.adress.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCoordinates =
        hasCoordinatesFilter === "all" ||
        (hasCoordinatesFilter === "with" && point.latitude && point.longitude) ||
        (hasCoordinatesFilter === "without" && (!point.latitude || !point.longitude))

      return matchesSearch && matchesCoordinates
    })

    // Сортировка
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case "point_id":
          aValue = a.point_id
          bValue = b.point_id
          break
        case "point_name":
          aValue = a.point_name
          bValue = b.point_name
          break
        case "created_at":
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case "updated_at":
          aValue = new Date(a.updated_at).getTime()
          bValue = new Date(b.updated_at).getTime()
          break
        default:
          aValue = a.point_id
          bValue = b.point_id
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue)
        return sortDirection === "asc" ? comparison : -comparison
      } else {
        const comparison = (aValue as number) - (bValue as number)
        return sortDirection === "asc" ? comparison : -comparison
      }
    })

    return filtered
  }, [points, searchQuery, sortField, sortDirection, hasCoordinatesFilter])

  const handleOpenDialog = (point?: Point) => {
    if (point) {
      setEditingPoint(point)
      setFormData({
        point_id: point.point_id,
        point_name: point.point_name,
        door_open_1: point.door_open_1 || "",
        door_open_2: point.door_open_2 || "",
        door_open_3: point.door_open_3 || "",
        latitude: point.latitude || "", // Теперь без пробела!
        longitude: point.longitude || "",
        adress: point.adress || "",
      })
    } else {
      setEditingPoint(null)
      setFormData({
        point_id: "",
        point_name: "",
        door_open_1: "",
        door_open_2: "",
        door_open_3: "",
        latitude: "",
        longitude: "",
        adress: "",
      })
    }
    setIsDialogOpen(true)
    setError(null)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingPoint(null)
    setError(null)
  }

  const handleCoordinatesChange = (lat: string, lng: string) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
  }

  const handleSubmit = async () => {
    if (!formData.point_id.trim()) {
      setError("Номер пункта обязателен")
      return
    }
    if (!formData.point_name.trim()) {
      setError("Название пункта обязательно")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const url = editingPoint ? `/api/points/${editingPoint.id}` : "/api/points"
      const method = editingPoint ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          point_id: formData.point_id.trim().toUpperCase(),
          point_name: formData.point_name.trim(),
          door_open_1: formData.door_open_1.trim() || null,
          door_open_2: formData.door_open_2.trim() || null,
          door_open_3: formData.door_open_3.trim() || null,
          latitude: formData.latitude.trim() || null,
          longitude: formData.longitude.trim() || null,
          adress: formData.adress.trim() || null,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        await fetchPoints()
        handleCloseDialog()
      } else {
        setError(result.error || "Ошибка при сохранении пункта")
      }
    } catch (error) {
      console.error("Error saving point:", error)
      setError("Ошибка при сохранении пункта")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить этот пункт?")) {
      return
    }

    try {
      const response = await fetch(`/api/points/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchPoints()
      } else {
        const result = await response.json()
        setError(result.error || "Ошибка при удалении пункта")
      }
    } catch (error) {
      console.error("Error deleting point:", error)
      setError("Ошибка при удалении пункта")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const getTimeWindows = (point: Point) => {
    const windows = []
    if (point.door_open_1) windows.push(point.door_open_1)
    if (point.door_open_2) windows.push(point.door_open_2)
    if (point.door_open_3) windows.push(point.door_open_3)
    return windows
  }

  const hasCoordinates = (point: Point) => {
    return point.latitude && point.longitude
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Управление пунктами</h1>
          <p className="text-muted-foreground">Создание и редактирование пунктов погрузки и разгрузки</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPoints} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить пункт
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPoint ? "Редактировать пункт" : "Добавить новый пункт"}</DialogTitle>
                <DialogDescription>Заполните информацию о пункте погрузки или разгрузки</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="point_id">Номер пункта *</Label>
                    <Input
                      id="point_id"
                      placeholder="Например: P001, D001"
                      value={formData.point_id}
                      onChange={(e) => setFormData({ ...formData, point_id: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="point_name">Название пункта *</Label>
                    <Input
                      id="point_name"
                      placeholder="Например: Склад №1 (Москва)"
                      value={formData.point_name}
                      onChange={(e) => setFormData({ ...formData, point_name: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adress">Адрес</Label>
                  <Input
                    id="adress"
                    placeholder="Например: г. Москва, ул. Примерная, д. 1"
                    value={formData.adress}
                    onChange={(e) => setFormData({ ...formData, adress: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Широта</Label>
                    <Input
                      id="latitude"
                      placeholder="55.753930"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Долгота</Label>
                    <Input
                      id="longitude"
                      placeholder="37.620795"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {(formData.latitude || formData.longitude) && (
                  <div className="space-y-2">
                    <Label>Позиция на карте</Label>
                    <p className="text-sm text-muted-foreground">Перетащите метку для корректировки координат</p>
                    <YandexMap
                      latitude={formData.latitude}
                      longitude={formData.longitude}
                      onCoordinatesChange={handleCoordinatesChange}
                      className="w-full h-64 rounded-md border"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="door_open_1">Временное окно 1</Label>
                    <Input
                      id="door_open_1"
                      placeholder="08:00-18:00"
                      value={formData.door_open_1}
                      onChange={(e) => setFormData({ ...formData, door_open_1: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="door_open_2">Временное окно 2</Label>
                    <Input
                      id="door_open_2"
                      placeholder="19:00-22:00"
                      value={formData.door_open_2}
                      onChange={(e) => setFormData({ ...formData, door_open_2: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="door_open_3">Временное окно 3</Label>
                    <Input
                      id="door_open_3"
                      placeholder="22:00-02:00"
                      value={formData.door_open_3}
                      onChange={(e) => setFormData({ ...formData, door_open_3: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                  Отмена
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>{editingPoint ? "Сохранить" : "Создать"}</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Фильтры и поиск */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Фильтры и поиск
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру, названию или адресу..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={hasCoordinatesFilter} onValueChange={setHasCoordinatesFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Координаты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все пункты</SelectItem>
                <SelectItem value="with">С координатами</SelectItem>
                <SelectItem value="without">Без координат</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortField}-${sortDirection}`}
              onValueChange={(value) => {
                const [field, direction] = value.split("-")
                setSortField(field as SortField)
                setSortDirection(direction as SortDirection)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="point_id-asc">Номер ↑</SelectItem>
                <SelectItem value="point_id-desc">Номер ↓</SelectItem>
                <SelectItem value="point_name-asc">Название ↑</SelectItem>
                <SelectItem value="point_name-desc">Название ↓</SelectItem>
                <SelectItem value="created_at-desc">Новые первые</SelectItem>
                <SelectItem value="created_at-asc">Старые первые</SelectItem>
                <SelectItem value="updated_at-desc">Обновленные первые</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Найдено: {filteredAndSortedPoints.length} из {points.length} пунктов
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Загрузка пунктов...
        </div>
      ) : filteredAndSortedPoints.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {points.length === 0 ? "Пункты не найдены" : "Нет результатов"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {points.length === 0
                ? "Создайте первый пункт для использования в рейсах"
                : "Попробуйте изменить параметры поиска или фильтры"}
            </p>
            {points.length === 0 && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить пункт
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Список пунктов ({filteredAndSortedPoints.length})</CardTitle>
            <CardDescription>Все доступные пункты погрузки и разгрузки</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Координаты</TableHead>
                  <TableHead>Временные окна</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPoints.map((point) => {
                  const timeWindows = getTimeWindows(point)
                  const coordinates = hasCoordinates(point)
                  return (
                    <TableRow key={point.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-blue-600" />
                          <Badge variant="outline" className="font-mono">
                            {point.point_id}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-medium">{point.point_name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {point.adress || "Не указан"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {coordinates ? (
                          <div className="flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-blue-600" />
                            <div className="text-xs font-mono">
                              <div>{Number.parseFloat(point.latitude!).toFixed(4)}</div>
                              <div>{Number.parseFloat(point.longitude!).toFixed(4)}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Не указаны</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {timeWindows.length > 0 ? (
                            timeWindows.map((window, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {window}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">Не указаны</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(point.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenDialog(point)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(point.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
