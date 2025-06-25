"use client"

import React from "react"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Navigation,
  X,
  Search,
} from "lucide-react"
import { YandexMap } from "@/components/yandex-map"

interface Point {
  id: number
  point_id: string
  point_name: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: string
  longitude?: string
  adress?: string
  created_at: string
  updated_at: string
}

type SortField = "point_id" | "point_name" | "adress" | "coordinates" | "time_windows" | "created_at"
type SortDirection = "asc" | "desc" | null

interface ColumnFilters {
  point_id: string[]
  point_name: string[]
  adress: string[]
  coordinates: string[]
  time_windows: string[]
  created_at: string[]
}

interface FilterSearches {
  point_id: string
  point_name: string
  adress: string
  coordinates: string
  time_windows: string
  created_at: string
}

interface PopoverStates {
  point_id: boolean
  point_name: boolean
  adress: boolean
  coordinates: boolean
  time_windows: boolean
  created_at: boolean
}

// Отдельный компонент для поиска - ВЫНЕСЕН НАРУЖУ
const SearchInputComponent = React.memo(
  ({
    field,
    placeholder = "Поиск...",
    onSearchChange,
    onClear,
  }: {
    field: string
    placeholder?: string
    onSearchChange: (value: string) => void
    onClear: () => void
  }) => {
    const [localValue, setLocalValue] = useState("")
    const timeoutRef = useRef<NodeJS.Timeout>()
    const renderCountRef = useRef(0)

    renderCountRef.current++
    console.log(`🔍 [SearchInput-${field}] Render #${renderCountRef.current}, localValue: "${localValue}"`)

    const handleChange = (value: string) => {
      console.log(`📝 [SearchInput-${field}] handleChange called with: "${value}"`)
      setLocalValue(value)

      // Debounce обновление родительского состояния
      if (timeoutRef.current) {
        console.log(`⏰ [SearchInput-${field}] Clearing existing timeout`)
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        console.log(`🚀 [SearchInput-${field}] Debounced update to parent: "${value}"`)
        onSearchChange(value)
      }, 150)
    }

    const handleClear = () => {
      console.log(`🧹 [SearchInput-${field}] handleClear called`)
      setLocalValue("")
      if (timeoutRef.current) {
        console.log(`⏰ [SearchInput-${field}] Clearing timeout on clear`)
        clearTimeout(timeoutRef.current)
      }
      onClear()
    }

    // Отслеживаем изменения localValue
    useEffect(() => {
      console.log(`🔄 [SearchInput-${field}] localValue changed to: "${localValue}"`)
    }, [localValue, field])

    useEffect(() => {
      return () => {
        console.log(`🗑️ [SearchInput-${field}] Component unmounting, cleaning timeout`)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [field])

    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => {
            console.log(`⌨️ [SearchInput-${field}] onChange event: "${e.target.value}"`)
            e.stopPropagation()
            handleChange(e.target.value)
          }}
          onKeyDown={(e) => {
            console.log(`🔤 [SearchInput-${field}] onKeyDown: ${e.key}`)
            e.stopPropagation()
          }}
          onClick={(e) => {
            console.log(`🖱️ [SearchInput-${field}] onClick`)
            e.stopPropagation()
          }}
          onFocus={(e) => {
            console.log(`🎯 [SearchInput-${field}] onFocus`)
          }}
          onBlur={(e) => {
            console.log(`😴 [SearchInput-${field}] onBlur`)
          }}
          className="h-8 pl-9 pr-8"
          autoComplete="off"
        />
        {localValue.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              console.log(`❌ [SearchInput-${field}] Clear button clicked`)
              e.stopPropagation()
              e.preventDefault()
              handleClear()
            }}
            onMouseDown={(e) => {
              e.preventDefault()
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  },
)

SearchInputComponent.displayName = "SearchInputComponent"

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

  // Состояние для сортировки и фильтрации
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    point_id: [],
    point_name: [],
    adress: [],
    coordinates: [],
    time_windows: [],
    created_at: [],
  })
  const [filterSearches, setFilterSearches] = useState<FilterSearches>({
    point_id: "",
    point_name: "",
    adress: "",
    coordinates: "",
    time_windows: "",
    created_at: "",
  })

  // Состояние для контроля открытия popover'ов
  const [popoverStates, setPopoverStates] = useState<PopoverStates>({
    point_id: false,
    point_name: false,
    adress: false,
    coordinates: false,
    time_windows: false,
    created_at: false,
  })

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

  // Подготовка данных для фильтров
  const filterOptions = useMemo(() => {
    const options = {
      point_id: Array.from(new Set(points.map((p) => p.point_id))).sort(),
      point_name: Array.from(new Set(points.map((p) => p.point_name))).sort(),
      adress: Array.from(new Set(points.map((p) => p.adress || "Не указан"))).sort(),
      coordinates: ["С координатами", "Без координат"],
      time_windows: ["С временными окнами", "Без временных окон"],
      created_at: Array.from(new Set(points.map((p) => new Date(p.created_at).toLocaleDateString("ru-RU")))).sort(),
    }
    return options
  }, [points])

  // Функция сортировки
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        if (sortDirection === "asc") {
          setSortDirection("desc")
        } else if (sortDirection === "desc") {
          setSortField(null)
          setSortDirection(null)
        }
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
    },
    [sortField, sortDirection],
  )

  // Функции управления popover'ами
  const handlePopoverOpen = useCallback((field: keyof PopoverStates, open: boolean) => {
    setPopoverStates((prev) => ({
      ...prev,
      [field]: open,
    }))
  }, [])

  // Функции фильтрации с отладкой
  const handleFilterChange = useCallback((field: keyof ColumnFilters, value: string, checked: boolean) => {
    console.log(`🔧 [Parent] handleFilterChange: ${field} - ${value} - ${checked}`)
    setColumnFilters((prev) => ({
      ...prev,
      [field]: checked ? [...prev[field], value] : prev[field].filter((v) => v !== value),
    }))
  }, [])

  // УБИРАЕМ filterSearches из зависимостей чтобы не вызывать перерендер
  const handleFilterSearchChange = useCallback((field: keyof FilterSearches, value: string) => {
    console.log(`🔍 [Parent] handleFilterSearchChange called: ${field} = "${value}"`)
    setFilterSearches((prev) => {
      console.log(`📊 [Parent] Current filterSearches before update:`, prev)
      const newState = {
        ...prev,
        [field]: value,
      }
      console.log(`📊 [Parent] New filterSearches after update:`, newState)
      return newState
    })
  }, []) // Убрали filterSearches из зависимостей!

  const clearFilter = useCallback((field: keyof ColumnFilters) => {
    console.log(`🧹 [Parent] clearFilter called for: ${field}`)
    setColumnFilters((prev) => ({
      ...prev,
      [field]: [],
    }))
    setFilterSearches((prev) => ({
      ...prev,
      [field]: "",
    }))
  }, [])

  const clearSearchOnly = useCallback((field: keyof FilterSearches) => {
    console.log(`🧹 [Parent] clearSearchOnly called for: ${field}`)
    setFilterSearches((prev) => ({
      ...prev,
      [field]: "",
    }))
  }, [])

  // Получение значения для фильтрации/сортировки
  const getFieldValue = useCallback((point: Point, field: SortField): string => {
    switch (field) {
      case "point_id":
        return point.point_id
      case "point_name":
        return point.point_name
      case "adress":
        return point.adress || "Не указан"
      case "coordinates":
        return point.latitude && point.longitude ? "С координатами" : "Без координат"
      case "time_windows":
        const hasWindows = point.door_open_1 || point.door_open_2 || point.door_open_3
        return hasWindows ? "С временными окнами" : "Без временных окон"
      case "created_at":
        return new Date(point.created_at).toLocaleDateString("ru-RU")
      default:
        return ""
    }
  }, [])

  // Фильтрованные и отсортированные пункты
  const filteredAndSortedPoints = useMemo(() => {
    let filtered = points

    // Применяем фильтры
    Object.entries(columnFilters).forEach(([field, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter((point) => {
          const fieldValue = getFieldValue(point, field as SortField)
          return values.includes(fieldValue)
        })
      }
    })

    // Сортировка
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aValue = getFieldValue(a, sortField)
        const bValue = getFieldValue(b, sortField)

        let comparison = 0
        if (sortField === "created_at") {
          const aDate = new Date(a.created_at).getTime()
          const bDate = new Date(b.created_at).getTime()
          comparison = aDate - bDate
        } else {
          comparison = aValue.localeCompare(bValue)
        }

        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return filtered
  }, [points, columnFilters, sortField, sortDirection, getFieldValue])

  // Мемоизированные компоненты поиска для каждого поля
  const searchComponents = useMemo(() => {
    const components: Record<string, React.ReactElement> = {}
    const fields: SortField[] = ["point_id", "point_name", "adress", "coordinates", "time_windows", "created_at"]

    fields.forEach((field) => {
      components[field] = (
        <SearchInputComponent
          key={`search-${field}`}
          field={field}
          onSearchChange={(value) => handleFilterSearchChange(field, value)}
          onClear={() => clearSearchOnly(field)}
        />
      )
    })

    return components
  }, [handleFilterSearchChange, clearSearchOnly])

  const handleOpenDialog = (point?: Point) => {
    if (point) {
      setEditingPoint(point)
      setFormData({
        point_id: point.point_id,
        point_name: point.point_name,
        door_open_1: point.door_open_1 || "",
        door_open_2: point.door_open_2 || "",
        door_open_3: point.door_open_3 || "",
        latitude: point.latitude || "",
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

  // Компонент заголовка колонки
  const ColumnHeader = ({
    field,
    children,
    className = "",
  }: {
    field: SortField
    children: React.ReactNode
    className?: string
  }) => {
    const isActive = sortField === field
    const hasActiveFilter = columnFilters[field].length > 0
    const isPopoverOpen = popoverStates[field]

    const getSortIcon = () => {
      if (!isActive) return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100" />
      if (sortDirection === "asc") return <ArrowUp className="h-3 w-3" />
      if (sortDirection === "desc") return <ArrowDown className="h-3 w-3" />
      return <ArrowUpDown className="h-3 w-3 opacity-50" />
    }

    const getFilteredOptions = () => {
      const options = filterOptions[field] || []
      const search = filterSearches[field].toLowerCase()
      return search ? options.filter((option) => option.toLowerCase().includes(search)) : options
    }

    return (
      <div className={`flex items-center justify-between group ${className}`}>
        <button
          className="flex items-center gap-1 hover:text-foreground text-left flex-1"
          onClick={() => handleSort(field)}
        >
          <span>{children}</span>
          {getSortIcon()}
        </button>

        <Popover open={isPopoverOpen} onOpenChange={(open) => handlePopoverOpen(field, open)}>
          <PopoverTrigger asChild>
            <button
              className={`ml-2 p-1 rounded hover:bg-muted ${
                hasActiveFilter ? "text-blue-600" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <Filter className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Фильтр</h4>
                {(columnFilters[field].length > 0 || filterSearches[field]) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearFilter(field)
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                    }}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    Сбросить всё
                  </Button>
                )}
              </div>

              {searchComponents[field]}

              <div className="max-h-48 overflow-y-auto space-y-2">
                {getFilteredOptions().map((option) => (
                  <div key={`${field}-${option}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field}-${option}`}
                      checked={columnFilters[field].includes(option)}
                      onCheckedChange={(checked) => {
                        handleFilterChange(field, option, checked as boolean)
                      }}
                    />
                    <label
                      htmlFor={`${field}-${option}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>

              {getFilteredOptions().length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Ничего не найдено</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
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
                : "Попробуйте изменить параметры фильтрации"}
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
            <CardTitle>
              Список пунктов ({filteredAndSortedPoints.length} из {points.length})
            </CardTitle>
            <CardDescription>Все доступные пункты погрузки и разгрузки</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <ColumnHeader field="point_id">Номер</ColumnHeader>
                  </TableHead>
                  <TableHead>
                    <ColumnHeader field="point_name">Название</ColumnHeader>
                  </TableHead>
                  <TableHead>
                    <ColumnHeader field="adress">Адрес</ColumnHeader>
                  </TableHead>
                  <TableHead>
                    <ColumnHeader field="coordinates">Координаты</ColumnHeader>
                  </TableHead>
                  <TableHead>
                    <ColumnHeader field="time_windows">Временные окна</ColumnHeader>
                  </TableHead>
                  <TableHead>
                    <ColumnHeader field="created_at">Создан</ColumnHeader>
                  </TableHead>
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
