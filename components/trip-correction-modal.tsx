"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import type { Trip, Point, User } from "@/lib/database"
import { PlusIcon, XIcon, ChevronDownIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { TripRow } from "./trip-row" // Import TripRow

interface TripCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "create" | "edit"
  initialTrip?: Trip | null
  onCorrectionSent?: () => void
}

interface DriverTripGroup {
  id: string
  driver: User | null
  trips: Trip[]
}

interface DriverSearchState {
  search: string
  open: boolean
}

const generateUniqueId = () => Math.random().toString(36).substring(2, 15)

// Helper to format date-time for input type="datetime-local"
const formatDateTime = (dateString?: string | Date | null): string => {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "" // Invalid date

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Helper to format date-time for saving (ISO string with seconds and Z)
const formatDateTimeForSave = (dateTimeLocalString: string): string => {
  if (!dateTimeLocalString) return ""
  const date = new Date(dateTimeLocalString)
  if (isNaN(date.getTime())) return ""
  return date.toISOString()
}

export function TripCorrectionModal({
  isOpen,
  onClose,
  mode,
  initialTrip,
  onCorrectionSent,
}: TripCorrectionModalProps) {
  const [driverTripGroups, setDriverTripGroups] = useState<DriverTripGroup[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [points, setPoints] = useState<Point[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPoints, setLoadingPoints] = useState(true)
  const [driverSearchStates, setDriverSearchStates] = useState<Record<string, DriverSearchState>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, pointsRes] = await Promise.all([fetch("/api/users"), fetch("/api/points")])

        if (usersRes.ok) {
          const usersData = await usersRes.json()
          setUsers(usersData)
        } else {
          console.error("Failed to fetch users:", await usersRes.text())
          toast({
            title: "Ошибка",
            description: "Не удалось загрузить список водителей.",
            variant: "destructive",
          })
        }

        if (pointsRes.ok) {
          const pointsData = await pointsRes.json()
          setPoints(pointsData)
        } else {
          console.error("Failed to fetch points:", await pointsRes.text())
          toast({
            title: "Ошибка",
            description: "Не удалось загрузить список точек.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Ошибка",
          description: "Произошла ошибка при загрузке данных.",
          variant: "destructive",
        })
      } finally {
        setLoadingUsers(false)
        setLoadingPoints(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialTrip) {
        const initialGroup: DriverTripGroup = {
          id: generateUniqueId(),
          driver: users.find((u) => u.telegram_id === initialTrip.driver_telegram_id) || null,
          trips: [{ ...initialTrip, points: initialTrip.points || [] }],
        }
        setDriverTripGroups([initialGroup])
        setDriverSearchStates({
          [initialGroup.id]: { search: initialGroup.driver?.full_name || "", open: false },
        })
      } else if (mode === "create") {
        const newGroupId = generateUniqueId()
        setDriverTripGroups([
          {
            id: newGroupId,
            driver: null,
            trips: [
              {
                trip_id: "",
                trip_identifier: "",
                driver_telegram_id: "",
                driver_name: "",
                driver_phone: "",
                car_number: "",
                carpark: "",
                status: "pending",
                planned_loading_time: null,
                comment: "",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                points: [],
              },
            ],
          },
        ])
        setDriverSearchStates({
          [newGroupId]: { search: "", open: false },
        })
      }
    }
  }, [isOpen, mode, initialTrip, users]) // Depend on users to ensure driver is found

  const addNewDriverGroup = useCallback(() => {
    const newGroupId = generateUniqueId()
    setDriverTripGroups((prev) => [
      ...prev,
      {
        id: newGroupId,
        driver: null,
        trips: [
          {
            trip_id: "",
            trip_identifier: "",
            driver_telegram_id: "",
            driver_name: "",
            driver_phone: "",
            car_number: "",
            carpark: "",
            status: "pending",
            planned_loading_time: null,
            comment: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            points: [],
          },
        ],
      },
    ])
    setDriverSearchStates((prev) => ({
      ...prev,
      [newGroupId]: { search: "", open: false },
    }))
  }, [])

  const removeDriverGroup = useCallback((groupId: string) => {
    setDriverTripGroups((prev) => prev.filter((group) => group.id !== groupId))
    setDriverSearchStates((prev) => {
      const newState = { ...prev }
      delete newState[groupId]
      return newState
    })
  }, [])

  const updateDriverForGroup = useCallback((groupId: string, selectedUser: User | null) => {
    setDriverTripGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = group.trips.map((trip) => ({
            ...trip,
            driver_telegram_id: selectedUser?.telegram_id || "",
            driver_name: selectedUser?.full_name || "",
            driver_phone: selectedUser?.phone_number || "",
          }))
          return { ...group, driver: selectedUser, trips: updatedTrips }
        }
        return group
      }),
    )
    setDriverSearchStates((prev) => ({
      ...prev,
      [groupId]: { search: selectedUser?.full_name || "", open: false },
    }))
  }, [])

  const updateTripInGroup = useCallback((groupId: string, tripIndex: number, field: keyof Trip, value: any) => {
    setDriverTripGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = group.trips.map((trip, idx) => {
            if (idx === tripIndex) {
              return {
                ...trip,
                [field]: field === "planned_loading_time" ? formatDateTimeForSave(value) : value,
                updated_at: new Date().toISOString(),
              }
            }
            return trip
          })
          return { ...group, trips: updatedTrips }
        }
        return group
      }),
    )
  }, [])

  const updatePointInGroup = useCallback(
    (groupId: string, tripIndex: number, pointIndex: number, field: keyof Point, value: any) => {
      setDriverTripGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.id === groupId) {
            const updatedTrips = group.trips.map((trip, tIdx) => {
              if (tIdx === tripIndex) {
                const updatedPoints = trip.points.map((point, pIdx) => {
                  if (pIdx === pointIndex) {
                    return { ...point, [field]: value }
                  }
                  return point
                })
                return { ...trip, points: updatedPoints }
              }
              return trip
            })
            return { ...group, trips: updatedTrips }
          }
          return group
        }),
      )
    },
    [],
  )

  const addNewTripToGroup = useCallback((groupId: string) => {
    setDriverTripGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          const newTrip: Trip = {
            trip_id: "",
            trip_identifier: "",
            driver_telegram_id: group.driver?.telegram_id || "",
            driver_name: group.driver?.full_name || "",
            driver_phone: group.driver?.phone_number || "",
            car_number: "",
            carpark: "",
            status: "pending",
            planned_loading_time: null,
            comment: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            points: [],
          }
          return { ...group, trips: [...group.trips, newTrip] }
        }
        return group
      }),
    )
  }, [])

  const removeTripFromGroup = useCallback((groupId: string, tripIndex: number) => {
    setDriverTripGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            trips: group.trips.filter((_, idx) => idx !== tripIndex),
          }
        }
        return group
      }),
    )
  }, [])

  const addNewPointToTripInGroup = useCallback((groupId: string, tripIndex: number) => {
    setDriverTripGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = group.trips.map((trip, tIdx) => {
            if (tIdx === tripIndex) {
              const newPoint: Point = {
                point_id: "",
                point_name: "",
                latitude: null,
                longitude: null,
                address: "",
                comment: "",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              return { ...trip, points: [...trip.points, newPoint] }
            }
            return trip
          })
          return { ...group, trips: updatedTrips }
        }
        return group
      }),
    )
  }, [])

  const removePointFromTripInGroup = useCallback((groupId: string, tripIndex: number, pointIndex: number) => {
    setDriverTripGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          const updatedTrips = group.trips.map((trip, tIdx) => {
            if (tIdx === tripIndex) {
              return {
                ...trip,
                points: trip.points.filter((_, pIdx) => pIdx !== pointIndex),
              }
            }
            return trip
          })
          return { ...group, trips: updatedTrips }
        }
        return group
      }),
    )
  }, [])

  const handleSave = async () => {
    let hasError = false
    const tripsToSave: Trip[] = []

    driverTripGroups.forEach((group) => {
      if (!group.driver) {
        toast({
          title: "Ошибка валидации",
          description: `Выберите водителя для группы ${group.id}.`,
          variant: "destructive",
        })
        hasError = true
        return
      }
      if (group.trips.length === 0) {
        toast({
          title: "Ошибка валидации",
          description: `Добавьте хотя бы один рейс для водителя ${group.driver.full_name}.`,
          variant: "destructive",
        })
        hasError = true
        return
      }

      group.trips.forEach((trip) => {
        if (!trip.trip_id || !trip.trip_identifier || !trip.car_number || !trip.carpark) {
          toast({
            title: "Ошибка валидации",
            description: `Заполните все обязательные поля (ID Рейса, Идентификатор, Номер ТС, Автопарк) для рейса ${trip.trip_id || "нового рейса"} водителя ${group.driver?.full_name}.`,
            variant: "destructive",
          })
          hasError = true
          return
        }
        tripsToSave.push(trip)
      })
    })

    if (hasError) return

    try {
      const endpoint = mode === "edit" ? `/api/trips/${initialTrip?.trip_id}/save-corrections` : "/api/send-messages"
      const method = mode === "edit" ? "POST" : "POST" // Both are POST for now

      const payload = mode === "edit" ? tripsToSave[0] : { trips: tripsToSave }

      const res = await fetch(endpoint, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === "trip_already_assigned" && data.conflict_data) {
          toast({
            title: "Ошибка: Рейс уже назначен",
            description: (
              <div>
                <p>
                  Рейс с номером рассылки <span className="font-bold">{data.conflict_data.trip_id}</span> уже назначен.
                </p>
                <p>Водитель: {data.conflict_data.driver_name}</p>
                <p>Телефон: {data.conflict_data.driver_phone}</p>
              </div>
            ),
            variant: "destructive",
          })
        } else {
          throw new Error(data.message || "Произошла ошибка при сохранении.")
        }
      } else {
        toast({
          title: "Успех",
          description: mode === "edit" ? "Рейс успешно обновлен." : "Рейсы успешно отправлены.",
        })
        onCorrectionSent?.()
        onClose()
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Неизвестная ошибка при сохранении.",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = useMemo(() => {
    return (groupId: string) => {
      const search = driverSearchStates[groupId]?.search || ""
      if (!search) return users
      return users.filter(
        (user) => user.full_name?.toLowerCase().includes(search.toLowerCase()) || user.phone_number?.includes(search),
      )
    }
  }, [users, driverSearchStates])

  const filteredPoints = useMemo(() => {
    return (search: string) => {
      if (!search) return points
      return points.filter(
        (point) =>
          point.point_name?.toLowerCase().includes(search.toLowerCase()) ||
          point.address?.toLowerCase().includes(search.toLowerCase()) ||
          String(point.point_id).includes(search),
      )
    }
  }, [points])

  if (loadingUsers || loadingPoints) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Загрузка данных...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Загрузка списка водителей и точек...</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Редактировать рейс" : "Быстрая рассылка"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {driverTripGroups.map((group, groupIndex) => (
            <div key={group.id} className="border p-4 rounded-md relative mb-4">
              {driverTripGroups.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeDriverGroup(group.id)}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
              <h3 className="text-lg font-semibold mb-3">Группа {groupIndex + 1}</h3>

              <div className="mb-4">
                <Label htmlFor={`driver-${group.id}`}>Водитель</Label>
                <Popover
                  open={driverSearchStates[group.id]?.open}
                  onOpenChange={(open) =>
                    setDriverSearchStates((prev) => ({ ...prev, [group.id]: { ...prev[group.id], open } }))
                  }
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={driverSearchStates[group.id]?.open}
                      className="w-full justify-between bg-transparent"
                    >
                      {group.driver ? group.driver.full_name || group.driver.phone_number : "Выберите водителя..."}
                      <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Поиск водителя..."
                        value={driverSearchStates[group.id]?.search}
                        onValueChange={(search) =>
                          setDriverSearchStates((prev) => ({ ...prev, [group.id]: { ...prev[group.id], search } }))
                        }
                      />
                      <CommandList>
                        <CommandEmpty>Водитель не найден.</CommandEmpty>
                        <CommandGroup>
                          {filteredUsers(group.id).map((user) => (
                            <CommandItem
                              key={user.telegram_id}
                              value={user.full_name || user.phone_number}
                              onSelect={() => {
                                updateDriverForGroup(group.id, user)
                                setDriverSearchStates((prev) => ({
                                  ...prev,
                                  [group.id]: { ...prev[group.id], open: false },
                                }))
                              }}
                            >
                              {user.full_name} ({user.phone_number})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {group.trips.map((trip, tripIndex) => (
                <TripRow
                  key={`${group.id}-${tripIndex}`}
                  trip={trip}
                  tripIndex={tripIndex}
                  points={points}
                  filteredPoints={filteredPoints}
                  updateTrip={(field, value) => updateTripInGroup(group.id, tripIndex, field, value)}
                  updatePoint={(pointIndex, field, value) =>
                    updatePointInGroup(group.id, tripIndex, pointIndex, field, value)
                  }
                  addNewPoint={() => addNewPointToTripInGroup(group.id, tripIndex)}
                  removePoint={(pointIndex) => removePointFromTripInGroup(group.id, tripIndex, pointIndex)}
                  removeTrip={() => removeTripFromGroup(group.id, tripIndex)}
                  isRemovable={group.trips.length > 1 || mode === "create"}
                />
              ))}
              {mode === "create" && (
                <Button
                  variant="outline"
                  className="w-full mt-4 bg-transparent"
                  onClick={() => addNewTripToGroup(group.id)}
                >
                  <PlusIcon className="mr-2 h-4 w-4" /> Добавить еще рейс для этого водителя
                </Button>
              )}
            </div>
          ))}
          {mode === "create" && (
            <Button variant="secondary" className="w-full mt-4" onClick={addNewDriverGroup}>
              <PlusIcon className="mr-2 h-4 w-4" /> Добавить еще водителя
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
