"use client"

import { useState, useMemo } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, PencilIcon, TrashIcon } from "lucide-react"
import type { Trip } from "@/lib/database" // Assuming Trip type is defined here
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface TripTableProps {
  trips: Trip[]
  onEdit: (trip: Trip) => void
  onDelete: (tripId: string) => void
}

export function TripTable({ trips, onEdit, onDelete }: TripTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [columnVisibility, setColumnVisibility] = useState({
    trip_id: true,
    trip_identifier: true,
    driver_name: true,
    driver_phone: true,
    car_number: true,
    carpark: true,
    status: true,
    planned_loading_time: true,
    created_at: true,
    updated_at: true,
    actions: true,
  })

  const filteredTrips = useMemo(() => {
    if (!Array.isArray(trips)) {
      console.error("Trips data is not an array:", trips)
      return []
    }
    return trips.filter((trip) =>
      Object.values(trip).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }, [trips, searchTerm])

  const columns = [
    { id: "trip_id", header: "ID Рейса", accessor: (trip: Trip) => trip.trip_id },
    { id: "trip_identifier", header: "Идентификатор", accessor: (trip: Trip) => trip.trip_identifier },
    { id: "driver_name", header: "Водитель", accessor: (trip: Trip) => trip.driver_name },
    { id: "driver_phone", header: "Телефон Водителя", accessor: (trip: Trip) => trip.driver_phone },
    { id: "car_number", header: "Номер ТС", accessor: (trip: Trip) => trip.car_number },
    { id: "carpark", header: "Автопарк", accessor: (trip: Trip) => trip.carpark },
    { id: "status", header: "Статус", accessor: (trip: Trip) => trip.status },
    {
      id: "planned_loading_time",
      header: "Плановое время погрузки",
      accessor: (trip: Trip) =>
        trip.planned_loading_time
          ? format(new Date(trip.planned_loading_time), "dd.MM.yyyy HH:mm", { locale: ru })
          : "N/A",
    },
    {
      id: "created_at",
      header: "Создан",
      accessor: (trip: Trip) => format(new Date(trip.created_at), "dd.MM.yyyy HH:mm", { locale: ru }),
    },
    {
      id: "updated_at",
      header: "Обновлен",
      accessor: (trip: Trip) => format(new Date(trip.updated_at), "dd.MM.yyyy HH:mm", { locale: ru }),
    },
  ]

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Поиск по рейсам..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto bg-transparent">
              Колонки <ChevronDownIcon className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={columnVisibility[column.id as keyof typeof columnVisibility]}
                onCheckedChange={(value) =>
                  setColumnVisibility((prev) => ({
                    ...prev,
                    [column.id]: value,
                  }))
                }
              >
                {column.header}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuCheckboxItem
              key="actions"
              className="capitalize"
              checked={columnVisibility.actions}
              onCheckedChange={(value) =>
                setColumnVisibility((prev) => ({
                  ...prev,
                  actions: value,
                }))
              }
            >
              Действия
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(
                (column) =>
                  columnVisibility[column.id as keyof typeof columnVisibility] && (
                    <TableHead key={column.id}>{column.header}</TableHead>
                  ),
              )}
              {columnVisibility.actions && <TableHead>Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTrips.length ? (
              filteredTrips.map((trip) => (
                <TableRow key={trip.trip_id}>
                  {columns.map(
                    (column) =>
                      columnVisibility[column.id as keyof typeof columnVisibility] && (
                        <TableCell key={column.id}>{column.accessor(trip)}</TableCell>
                      ),
                  )}
                  {columnVisibility.actions && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(trip)} className="mr-2">
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(trip.trip_id)}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (columnVisibility.actions ? 1 : 0)} className="h-24 text-center">
                  Нет результатов.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
