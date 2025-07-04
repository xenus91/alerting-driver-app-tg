"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, Save, AlertTriangle } from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
} from "@tanstack/react-table"

interface TableData {
  [key: string]: any
}

interface TableSchema {
  name: string
  columns: { name: string; type: string }[]
}

export default function DatabaseViewer() {
  const [tables, setTables] = useState<TableSchema[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [data, setData] = useState<TableData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; column: string } | null>(null)
  const [editValue, setEditValue] = useState<string | number | boolean | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  // Проверка авторизации
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("[DatabaseViewer] Checking authentication...")
        const response = await fetch("/api/auth/me", {
          headers: { "Cache-Control": "no-cache" },
        })
        const result = await response.json()
        console.log("[DatabaseViewer] Auth response:", result)
        if (!result.success || result.user?.role !== "admin") {
          setError("Access denied: Admin role required")
        }
      } catch (error) {
        setError(`Authentication error: ${error.message}`)
        console.error("[DatabaseViewer] Auth check error:", error)
      }
    }
    checkAuth()
  }, [])

  // Загрузка списка таблиц
  useEffect(() => {
    const fetchTables = async () => {
      setIsLoading(true)
      setError(null)
      try {
        console.log("[DatabaseViewer] Fetching tables...")
        const response = await fetch("/api/database/tables", {
          headers: { "Cache-Control": "no-cache" },
        })
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
        }
        const result = await response.json()
        console.log("[DatabaseViewer] Tables response:", result)
        if (result.success) {
          setTables(result.tables)
        } else {
          setError(result.error || "Failed to load tables")
        }
      } catch (error) {
        setError(`Error loading tables: ${error.message}`)
        console.error("[DatabaseViewer] Error fetching tables:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTables()
  }, [])

  // Загрузка данных выбранной таблицы
  useEffect(() => {
    if (selectedTable) {
      const fetchTableData = async () => {
        setIsLoading(true)
        setError(null)
        try {
          const params = new URLSearchParams()
          const validColumns = tables.find((t) => t.name === selectedTable)?.columns.map((c) => c.name) || []
          columnFilters.forEach((filter) => {
            if (validColumns.includes(filter.id)) {
              params.append(filter.id, filter.value as string)
            } else {
              console.warn(`[DatabaseViewer] Invalid filter column ${filter.id} for table ${selectedTable}`)
            }
          })
          if (sorting.length > 0 && validColumns.includes(sorting[0].id)) {
            params.append("sortBy", sorting[0].id)
            params.append("sortOrder", sorting[0].desc ? "DESC" : "ASC")
          } else if (sorting.length > 0) {
            console.warn(`[DatabaseViewer] Invalid sort column ${sorting[0].id} for table ${selectedTable}`)
          }
          console.log(`[DatabaseViewer] Fetching data for table ${selectedTable} with params: ${params.toString()}`)
          const response = await fetch(`/api/database/table/${selectedTable}?${params.toString()}`, {
            headers: { "Cache-Control": "no-cache" },
          })
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
          }
          const result = await response.json()
          console.log(`[DatabaseViewer] Data response for table ${selectedTable}:`, result)
          if (result.success) {
            setData(result.data)
          } else {
            setError(result.error || `Failed to load data for table ${selectedTable}`)
          }
        } catch (error) {
          setError(`Error loading table data: ${error.message}`)
          console.error(`[DatabaseViewer] Error fetching data for table ${selectedTable}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchTableData()
    }
  }, [selectedTable, columnFilters, sorting, tables])

  const columns: ColumnDef<TableData>[] = useMemo(() => {
    if (!selectedTable || !tables.length) return []
    const tableSchema = tables.find((t) => t.name === selectedTable)
    if (!tableSchema) return []

    return [
      ...tableSchema.columns.map((col) => ({
        accessorKey: col.name,
        header: col.name,
        filterFn: "includesString",
        cell: ({ row, column }) => {
          const value = row.getValue(column.id)
          return editingCell?.row === row.index && editingCell?.column === column.id ? (
            <div className="flex gap-2">
              <Input
                value={editValue ?? value}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full"
              />
              <Button
                size="sm"
                onClick={() => handleSaveEdit(row.original, column.id)}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onClick={() => {
                setEditingCell({ row: row.index, column: column.id })
                setEditValue(value)
              }}
              className="cursor-pointer"
            >
              {value ?? "—"}
            </div>
          )
        },
      })),
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteRow(row.original)}
              title="Delete row"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ]
  }, [selectedTable, tables, editingCell, editValue])

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const handleSaveEdit = async (row: TableData, column: string) => {
    if (!selectedTable) return
    setIsLoading(true)
    setError(null)
    try {
      console.log(`[DatabaseViewer] Saving edit: table=${selectedTable}, id=${row.id}, column=${column}, value=${editValue}`)
      const response = await fetch(`/api/database/table/${selectedTable}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, column, value: editValue }),
      })
      const result = await response.json()
      console.log(`[DatabaseViewer] Save edit response:`, result)
      if (result.success) {
        setData((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, [column]: editValue } : r))
        )
        setEditingCell(null)
        setEditValue(null)
      } else {
        setError(result.error || "Failed to update row")
      }
    } catch (error) {
      setError(`Error updating row: ${error.message}`)
      console.error("[DatabaseViewer] Error updating row:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRow = async (row: TableData) => {
    if (!selectedTable || !confirm("Are you sure you want to delete this row?")) return
    setIsLoading(true)
    setError(null)
    try {
      console.log(`[DatabaseViewer] Deleting row: table=${selectedTable}, id=${row.id}`)
      const response = await fetch(`/api/database/table/${selectedTable}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      })
      const result = await response.json()
      console.log(`[DatabaseViewer] Delete row response:`, result)
      if (result.success) {
        setData((prev) => prev.filter((r) => r.id !== row.id))
      } else {
        setError(result.error || "Failed to delete row")
      }
    } catch (error) {
      setError(`Error deleting row: ${error.message}`)
      console.error("[DatabaseViewer] Error deleting row:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Просмотр базы данных</h1>
        <p className="text-muted-foreground">Управление данными таблиц базы данных</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <Select value={selectedTable || ""} onValueChange={setSelectedTable}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Выберите таблицу" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.name} value={table.name}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTable && data.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                      {header.column.getCanFilter() ? (
                        <Input
                          placeholder={`Фильтр ${header.column.columnDef.header}`}
                          value={(header.column.getFilterValue() as string) ?? ""}
                          onChange={(e) => header.column.setFilterValue(e.target.value)}
                          className="mt-1"
                        />
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : selectedTable ? (
        <p>Нет данных для отображения</p>
      ) : null}
    </div>
  )
}
