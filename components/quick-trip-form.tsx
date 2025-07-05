"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RefreshCw, Send, Plus, Trash2, User, Zap, Check, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface TripData {
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment: string
  points: Array<{
    point_type: "P" | "D"
    point_num: number
    point_id: string
  }>
}

interface Driver {
  phone: string
  first_name?: string
  full_name?: string
  name: string
  telegram_id: number
  verified: boolean
}

interface QuickTripFormProps {
  isOpen: boolean
  onClose: () => void
  onTripSent: () => void
}

interface DriverWithTrips {
  driver: Driver;
  trips: TripData[];
}

export function QuickTripForm({ isOpen, onClose, onTripSent }: QuickTripFormProps) {
  const [driverTrips, setDriverTrips] = useState<DriverWithTrips[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [availablePoints, setAvailablePoints] = useState<Array<{ point_id: string; point_name: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Состояния для поиска
  const [driverSearchOpen, setDriverSearchOpen] = useState<{ [key: string]: boolean }>({});
  const [pointSearchOpen, setPointSearchOpen] = useState<{ [key: string]: boolean }>({})

  // Загружаем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadDrivers();
      loadAvailablePoints();
      setDriverTrips([{ driver: createEmptyDriver(), trips: [createEmptyTrip()] }]);
      setError(null);
      setSuccess(null);
      setPointSearchOpen({});
      setDriverSearchOpen({});
    }
  }, [isOpen]);

  const createEmptyDriver = (): Driver => ({
    phone: "",
    name: "",
    telegram_id: 0,
    verified: true,
  });

  const createEmptyTrip = (): TripData => ({
    trip_identifier: "",
    vehicle_number: "",
    planned_loading_time: new Date().toISOString().slice(0, 16) + ":00.000",
    driver_comment: "",
    points: [
      {
        point_type: "P",
        point_num: 1,
        point_id: "",
      },
    ],
  })

  const loadDrivers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/users")
      const data = await response.json()

      if (data.success) {
        const verifiedDrivers = data.users.filter((user: Driver) => user.verified && user.telegram_id)
        setDrivers(verifiedDrivers)
      } else {
        setError("Ошибка загрузки списка водителей")
      }
    } catch (error) {
      setError("Ошибка загрузки водителей")
      console.error("Error loading drivers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailablePoints = async () => {
    try {
      const response = await fetch("/api/points")
      const data = await response.json()

      if (data.success) {
        setAvailablePoints(data.points.map((p: any) => ({ point_id: p.point_id, point_name: p.point_name })))
      }
    } catch (error) {
      console.error("Error loading points:", error)
    }
  }

  // Обновление водителя по индексу
  const updateDriver = (driverIndex: number, driver: Driver) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      updated[driverIndex] = { ...updated[driverIndex], driver };
      return updated;
    });
  };

  const updateTrip = (driverIndex: number, tripIndex: number, field: keyof TripData, value: any) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      updated[driverIndex].trips[tripIndex] = { 
        ...updated[driverIndex].trips[tripIndex], 
        [field]: value 
      };
      return updated;
    });
  };

  // Обновление точки
  const updatePoint = (driverIndex: number, tripIndex: number, pointIndex: number, field: string, value: any) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      updated[driverIndex].trips[tripIndex].points[pointIndex] = { 
        ...updated[driverIndex].trips[tripIndex].points[pointIndex], 
        [field]: value 
      };
      return updated;
    });
  };

  // Добавление нового водителя
  const addNewDriver = () => {
    setDriverTrips(prev => [
      ...prev, 
      { driver: createEmptyDriver(), trips: [createEmptyTrip()] }
    ]);
  };

  // Удаление водителя
  const removeDriver = (driverIndex: number) => {
    if (driverTrips.length > 1) {
      setDriverTrips(prev => prev.filter((_, i) => i !== driverIndex));
    }
  };

  // Добавление рейса для конкретного водителя
  const addNewTrip = (driverIndex: number) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      updated[driverIndex].trips = [...updated[driverIndex].trips, createEmptyTrip()];
      return updated;
    });
  };

  // Удаление рейса
  const removeTrip = (driverIndex: number, tripIndex: number) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      if (updated[driverIndex].trips.length > 1) {
        updated[driverIndex].trips = updated[driverIndex].trips.filter((_, i) => i !== tripIndex);
      }
      return updated;
    });
  };

  // Добавление точки
  const addNewPoint = (driverIndex: number, tripIndex: number) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      const points = updated[driverIndex].trips[tripIndex].points;
      const newPointNum = points.length > 0 ? Math.max(...points.map(p => p.point_num)) + 1 : 1;
      
      points.push({
        point_type: "P",
        point_num: newPointNum,
        point_id: "",
      });
      return updated;
    });
  };

  // Удаление точки
  const removePoint = (driverIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      const points = updated[driverIndex].trips[tripIndex].points;
      if (points.length > 1) {
        points.splice(pointIndex, 1);
        // Пересчитываем порядок точек после удаления
        recalculatePointOrder(updated[driverIndex].trips[tripIndex].points);
      }
      return updated;
    });
  };

  // Перемещение точки вверх
  const movePointUp = (driverIndex: number, tripIndex: number, pointIndex: number) => {
    if (pointIndex === 0) return;
    
    setDriverTrips(prev => {
      const updated = [...prev];
      const points = updated[driverIndex].trips[tripIndex].points;
      
      // Меняем местами с предыдущей точкой
      [points[pointIndex - 1], points[pointIndex]] = [points[pointIndex], points[pointIndex - 1]];
      
      // Пересчитываем порядок точек
      recalculatePointOrder(points);
      
      return updated;
    });
  };

  // Перемещение точки вниз
  const movePointDown = (driverIndex: number, tripIndex: number, pointIndex: number) => {
    setDriverTrips(prev => {
      const updated = [...prev];
      const points = updated[driverIndex].trips[tripIndex].points;
      
      if (pointIndex >= points.length - 1) return prev;
      
      // Меняем местами со следующей точкой
      [points[pointIndex], points[pointIndex + 1]] = [points[pointIndex + 1], points[pointIndex]];
      
      // Пересчитываем порядок точек
      recalculatePointOrder(points);
      
      return updated;
    });
  };

  // Пересчет порядка точек
  const recalculatePointOrder = (points: any[]) => {
    points.forEach((point, index) => {
      point.point_num = index + 1;
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ""
    try {
      if (dateString.includes("T")) {
        return dateString.slice(0, 16)
      }
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hours = String(date.getHours()).padStart(2, "0")
      const minutes = String(date.getMinutes()).padStart(2, "0")
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return dateString
    }
  }

  const formatDateTimeForSave = (dateString: string) => {
    if (!dateString) return ""
    return dateString + ":00.000"
  }

  // Валидация формы
  const validateForm = () => {
    for (const driverTrip of driverTrips) {
      if (!driverTrip.driver.phone) {
        setError("Выберите водителя для всех секций");
        return false;
      }

      for (const trip of driverTrip.trips) {
        if (!trip.trip_identifier.trim()) {
          setError("Заполните номер рейса для всех рейсов");
          return false;
        }
        if (!trip.vehicle_number.trim()) {
          setError("Заполните номер транспорта для всех рейсов");
          return false;
        }
        if (!trip.planned_loading_time) {
          setError("Укажите время погрузки для всех рейсов");
          return false;
        }

        for (const point of trip.points) {
          if (!point.point_id) {
            setError("Выберите все точки в рейсах");
            return false;
          }
        }
      }
    }

    return true;
  };

  // Отправка данных
  const sendQuickTrip = async () => {
    if (!validateForm()) return;

    setIsSending(true);
    setError(null);

    try {
      const tripData = driverTrips.flatMap(driverTrip => 
        driverTrip.trips.map(trip => ({
          phone: driverTrip.driver.phone,
          trip_identifier: trip.trip_identifier,
          vehicle_number: trip.vehicle_number,
          planned_loading_time: trip.planned_loading_time,
          driver_comment: trip.driver_comment,
          loading_points: trip.points
            .filter(p => p.point_type === "P")
            .map(p => ({
              point_id: p.point_id,
              point_num: p.point_num,
            })),
          unloading_points: trip.points
            .filter(p => p.point_type === "D")
            .map(p => ({
              point_id: p.point_id,
              point_num: p.point_num,
            })),
        }))
      );

      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Рассылка отправлена успешно! Отправлено ${data.results?.sent || 0} сообщений.`);
        onTripSent();
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setError(data.error || "Ошибка при отправке рассылки");
      }
    } catch (error) {
      setError("Ошибка при отправке рассылки");
      console.error("Error sending quick trip:", error);
    } finally {
      setIsSending(false);
    }
  };

  const getDriverDisplayName = (driver: Driver) => {
    return driver.full_name || driver.first_name || driver.name || `ID: ${driver.telegram_id}`
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("380") && phone.length === 12) {
      return `+380 (${phone.slice(3, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
    } else if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`
    }
    return phone
  }

  // Функция поиска водителей
  const filterDrivers = (searchValue: string) => {
    if (!searchValue) return drivers;
    const search = searchValue.toLowerCase();
    return drivers.filter(driver => {
      const fullName = (driver.full_name || driver.first_name || driver.name || "").toLowerCase();
      const phone = driver.phone.toLowerCase();
      return fullName.includes(search) || phone.includes(search);
    });
  };

  // Функция поиска точек
  const filterPoints = (searchValue: string) => {
    if (!searchValue) return availablePoints;
    const search = searchValue.toLowerCase();
    return availablePoints.filter(point => {
      const pointId = point.point_id.toLowerCase();
      const pointName = (point.point_name || "").toLowerCase();
      return pointId.includes(search) || pointName.includes(search);
    });
  };

  const getSelectedPointName = (pointId: string) => {
    const point = availablePoints.find((p) => p.point_id === pointId)
    return point ? `${point.point_id} - ${point.point_name}` : "Выберите точку"
  };

  const togglePointSearch = (key: string) => {
    setPointSearchOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  };

  // Функция для переключения состояния поиска водителя
  const toggleDriverSearch = (key: string) => {
    setDriverSearchOpen(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Быстрая рассылка рейса
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Загрузка данных...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Кнопка добавления водителя */}
            <div className="flex justify-end">
              <Button onClick={addNewDriver} variant="outline" className="text-green-600">
                <Plus className="h-4 w-4 mr-2" />
                Добавить водителя
              </Button>
            </div>

            {/* Цикл по водителям */}
            {driverTrips.map((driverTrip, driverIndex) => (
              <div key={driverIndex} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Водитель #{driverIndex + 1}</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => addNewTrip(driverIndex)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить рейс
                    </Button>
                    {driverTrips.length > 1 && (
                      <Button
                        onClick={() => removeDriver(driverIndex)}
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить водителя
                      </Button>
                    )}
                  </div>
                </div>

                {/* Выбор водителя */}
                <div className="border rounded-lg p-4 bg-blue-50 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Выбор водителя</h3>
                  </div>

                  <Popover 
                    open={driverSearchOpen[`driver-${driverIndex}`] || false} 
                    onOpenChange={() => toggleDriverSearch(`driver-${driverIndex}`)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={driverSearchOpen[`driver-${driverIndex}`] || false}
                        className="w-full justify-between"
                      >
                        {driverTrip.driver.phone 
                          ? `${getDriverDisplayName(driverTrip.driver)} (${formatPhone(driverTrip.driver.phone)})` 
                          : "Выберите водителя"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Поиск по имени или телефону..." />
                        <CommandList>
                          <CommandEmpty>Водители не найдены.</CommandEmpty>
                          <CommandGroup>
                            {filterDrivers("").map(driver => (
                              <CommandItem
                                key={driver.phone}
                                value={`${getDriverDisplayName(driver)} ${driver.phone}`}
                                onSelect={() => {
                                  updateDriver(driverIndex, driver);
                                  toggleDriverSearch(`driver-${driverIndex}`);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    driverTrip.driver.phone === driver.phone ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{getDriverDisplayName(driver)}</span>
                                  <span className="text-sm text-gray-500">{formatPhone(driver.phone)}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Рейсы водителя */}
                {driverTrip.trips.map((trip, tripIndex) => (
                  <div key={tripIndex} className="border rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Рейс #{tripIndex + 1}</h3>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addNewPoint(driverIndex, tripIndex)}
                          variant="outline"
                          size="sm"
                          className="text-blue-600"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Добавить точку
                        </Button>
                        {driverTrip.trips.length > 1 && (
                          <Button
                            onClick={() => removeTrip(driverIndex, tripIndex)}
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Удалить рейс
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="text-sm font-medium">Номер рейса *</label>
                        <Input
                          value={trip.trip_identifier}
                          onChange={(e) => updateTrip(driverIndex, tripIndex, "trip_identifier", e.target.value)}
                          placeholder="Введите номер рейса"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Транспорт *</label>
                        <Input
                          value={trip.vehicle_number}
                          onChange={(e) => updateTrip(driverIndex, tripIndex, "vehicle_number", e.target.value)}
                          placeholder="Номер транспорта"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Время погрузки *</label>
                        <Input
                          type="datetime-local"
                          value={formatDateTime(trip.planned_loading_time)}
                          onChange={(e) =>
                            updateTrip(driverIndex, tripIndex, "planned_loading_time", formatDateTimeForSave(e.target.value))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Комментарий</label>
                        <Input
                          value={trip.driver_comment}
                          onChange={(e) => updateTrip(driverIndex, tripIndex, "driver_comment", e.target.value)}
                          placeholder="Комментарий водителю"
                        />
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Тип</TableHead>
                          <TableHead>Точка *</TableHead>
                          <TableHead>Порядок</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trip.points.map((point, pointIndex) => {
                          const searchKey = `${driverIndex}-${tripIndex}-${pointIndex}`;
                          const isFirst = pointIndex === 0;
                          const isLast = pointIndex === trip.points.length - 1;
                          
                          return (
                            <TableRow key={pointIndex}>
                              <TableCell>
                                <Select
                                  value={point.point_type}
                                  onValueChange={(value: "P" | "D") =>
                                    updatePoint(driverIndex, tripIndex, pointIndex, "point_type", value)
                                  }
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="P">
                                      <Badge variant="outline" className="bg-blue-100 text-blue-600">
                                        P
                                      </Badge>
                                    </SelectItem>
                                    <SelectItem value="D">
                                      <Badge variant="outline" className="bg-green-100 text-green-600">
                                        D
                                      </Badge>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Popover
                                  open={pointSearchOpen[searchKey] || false}
                                  onOpenChange={() => togglePointSearch(searchKey)}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={pointSearchOpen[searchKey] || false}
                                      className="w-full justify-between"
                                    >
                                      {point.point_id ? getSelectedPointName(point.point_id) : "Выберите точку"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Поиск по коду или названию..." />
                                      <CommandList>
                                        <CommandEmpty>Точки не найдены.</CommandEmpty>
                                        <CommandGroup>
                                          {filterPoints("").map((availablePoint) => (
                                            <CommandItem
                                              key={availablePoint.point_id}
                                              value={`${availablePoint.point_id} ${availablePoint.point_name}`}
                                              onSelect={() => {
                                                updatePoint(driverIndex, tripIndex, pointIndex, "point_id", availablePoint.point_id)
                                                togglePointSearch(searchKey)
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  point.point_id === availablePoint.point_id ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span className="font-medium">{availablePoint.point_id}</span>
                                                <span className="text-sm text-gray-500">{availablePoint.point_name}</span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => movePointUp(driverIndex, tripIndex, pointIndex)}
                                    disabled={isFirst}
                                    title="Переместить вверх"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => movePointDown(driverIndex, tripIndex, pointIndex)}
                                    disabled={isLast}
                                    title="Переместить вниз"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  onClick={() => removePoint(driverIndex, tripIndex, pointIndex)}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600"
                                  disabled={trip.points.length === 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ))}

            <div className="flex gap-4 justify-end">
              <Button onClick={onClose} variant="outline">
                Отмена
              </Button>
              <Button onClick={sendQuickTrip} disabled={isSending}>
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить рассылку
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
