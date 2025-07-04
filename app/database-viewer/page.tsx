"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Trash2, Save, X, AlertTriangle } from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
} from "@tanstack/react-table"
import { debounce } from "lodash"

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
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editValue, setEditValue] = useState<any>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalRows, setTotalRows] = useState(0)
  const [distinctValues, setDistinctValues] = useState<{ [column: string]: string[] }>({})
  const [filterSearch, setFilterSearch] = useState<{ [column: string]: string }>({})
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; row: TableData | null }>({ open: false, row: null })
  const tableRef = useRef<HTMLDivElement>(null)

  // Проверка авторизации
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("[DatabaseViewer] Checking authentication...")
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        const result = await response.json()
        if (!result.success || result.user?.role !== "admin") {
          setError("Access denied: Admin role required")
        }
      } catch (error) {
        setError(`Authentication error: ${error instanceof Error ? error.message : "Unknown error"}`)
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
        const response = await fetch("/api/database/tables", { cache: "no-store" })
        const result = await response.json()
        if (result.success) {
          setTables(result.tables)
        } else {
          setError(result.error || "Failed to load tables")
        }
      } catch (error) {
        setError(`Error loading tables: ${error instanceof Error ? error.message : "Unknown error"}`)
        console.error("[DatabaseViewer] Error fetching tables:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTables()
  }, [])

  // Загрузка уникальных значений для фильтров
  const fetchDistinctValues = useCallback(
    async (table: string, column: string) => {
      try {
        const response = await fetch(`/api/database/table/${table}/distinct?column=${column}`, { cache: "no-store" })
        const result = await response.json()
        if (result.success) {
          // Фильтруем null, пустые строки и пробелы
          const filteredData = result.data
            .filter((val: any) => val !== null && val !== undefined && String(val).trim() !== "")
            .map((val: any) => String(val).trim());
          console.log(`[DatabaseViewer] Distinct values for ${column}:`, filteredData);
          setDistinctValues((prev) => ({ ...prev, [column]: filteredData }))
        } else {
          console.error(`[DatabaseViewer] Failed to fetch distinct values for ${column}:`, result.error);
        }
      } catch (error) {
        console.error(`[DatabaseViewer] Error fetching distinct values for ${column}:`, error)
      }
    },
    []
  )

  // Загрузка данных таблицы с пагинацией
  useEffect(() => {
    if (!selectedTable) return

    const fetchTableData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.append("offset", String(pageIndex * pageSize))
        params.append("limit", String(pageSize))
        const validColumns = tables.find((t) => t.name === selectedTable)?.columns.map((c) => c.name) || []

        columnFilters.forEach((filter) => {
          if (validColumns.includes(filter.id) && filter.value && String(filter.value).trim() !== "") {
            params.append(filter.id, String(filter.value))
          } else {
            console.warn(`[DatabaseViewer] Invalid or empty filter column ${filter.id} for table ${selectedTable}`)
          }
        })

        if (sorting.length > 0 && validColumns.includes(sorting[0].id)) {
          params.append("sortBy", sorting[0].id)
          params.append("sortOrder", sorting[0].desc ? "DESC" : "ASC")
        }

        console.log(`[DatabaseViewer] Fetching data for table ${selectedTable} with params: ${params.toString()}`)
        const response = await fetch(`/api/database/table/${selectedTable}?${params.toString()}`, { cache: "no-store" })
        const result = await response.json()
        if (result.success) {
          setData(result.data)
          setTotalRows(result.total || result.data.length)
          validColumns.forEach((column) => fetchDistinctValues(selectedTable, column))
        } else {
          setError(result.error || `Failed to load data for table ${selectedTable}`)
        }
      } catch (error) {
        setError(`Error loading table data: ${error instanceof Error ? error.message : "Unknown error"}`)
        console.error(`[DatabaseViewer] Error fetching data for table ${selectedTable}:`, error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTableData()
  }, [selectedTable, columnFilters, sorting, pageIndex, pageSize, tables, fetchDistinctValues])

  // Обработчики для горизонтальной прокрутки
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tableRef.current) {
      setIsDragging(true)
      setStartX(e.pageX - tableRef.current.offsetLeft)
      setScrollLeft(tableRef.current.scrollLeft)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !tableRef.current) return
    e.preventDefault()
    const x = e.pageX - tableRef.current.offsetLeft
    const walk = (x - startX) * 2
    tableRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Дебаунс для поиска в фильтрах
  const debouncedSetFilterSearch = useMemo(
    () =>
      debounce((column: string, value: string) => {
        setFilterSearch((prev) => ({ ...prev, [column]: value }))
      }, 300),
    []
  )

  const columns = useMemo<ColumnDef<TableData>[]>(
    () => {
      if (!selectedTable || tables.length === 0) return []

      const tableSchema = tables.find((t) => t.name === selectedTable)
      if (!tableSchema) return []

      const baseColumns: ColumnDef<TableData>[] = tableSchema.columns.map((col) => ({
        accessorKey: col.name,
        header: col.name,
        filterFn: "equals",
        cell: ({ row, column }) => {
          const value = row.getValue(column.id)
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id

          return isEditing ? (
            <div className="flex gap-2 items-center">
              <Input
                value={editValue ?? value}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-48 h-8"
                autoFocus
              />
              <Button size="sm" onClick={() => handleSaveEdit(row.original, column.id)}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingCell(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onDoubleClick={() => {
                setEditingCell({ rowId: row.id, columnId: column.id })
                setEditValue(value)
              }}
              className="cursor-pointer hover:bg-gray-100 p-2 rounded min-w-[100px]"
            >
              {value !== null && value !== undefined ? String(value) : "—"}
            </div>
          )
        },
        meta: {
          filterComponent: ({ column }: { column: any }) => {
            const columnName = column.id
            const values = distinctValues[columnName] || []
            const search = filterSearch[columnName] || ""

            const filteredValues = values
              .filter((val) => String(val).toLowerCase().includes(search.toLowerCase()))
              .filter((val) => val !== null && val !== undefined && String(val).trim() !== "");

            console.log(`[DatabaseViewer] Filtered values for ${columnName}:`, filteredValues);

            return (
              <div className="space-y-2">
                <Input
                  placeholder="Поиск значений..."
                  value={search}
                  onChange={(e) => debouncedSetFilterSearch(columnName, e.target.value)}
                  className="h-8"
                />
                <Select
                  value={String(column.getFilterValue() || "")}
                  onValueChange={(value) => column.setFilterValue(value === "" ? undefined : value)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Выберите значение" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="">Все</SelectItem>
                    {filteredValues.map((val) => {
                      const stringVal = String(val).trim();
                      return (
                        <SelectItem key={stringVal} value={stringVal}>
                          {stringVal || "—"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )
          },
        },
      }))

      baseColumns.push({
        id: "actions",
        header: "Действия",
        cell: ({ row }) => (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialog({ open: true, row: row.original })}
            title="Удалить строку"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      })

      return baseColumns
    },
    [selectedTable, tables, editingCell, editValue, distinctValues, filterSearch, debouncedSetFilterSearch]
  )

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, pagination: { pageIndex, pageSize } },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newState = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater
      setPageIndex(newState.pageIndex)
      setPageSize(newState.pageSize)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalRows / pageSize),
  })

  const handleSaveEdit = async (row: TableData, columnId: string) => {
    if (!selectedTable || editValue === null) return

    const originalValue = row[columnId]
    setData((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, [columnId]: editValue } : r))
    )
    setEditingCell(null)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/database/table/${selectedTable}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, column: columnId, value: editValue }),
      })

      const result = await response.json()
      if (!result.success) {
        setData((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, [columnId]: originalValue } : r))
        )
        setError(result.error || "Не удалось обновить строку")
      }
    } catch (error) {
      setData((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [columnId]: originalValue } : r))
      )
      setError(`Ошибка обновления строки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      console.error("[DatabaseViewer] Error updating row:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRow = async () => {
    if (!selectedTable || !deleteDialog.row) return

    const rowId = deleteDialog.row.id
    setData((prev) => prev.filter((r) => r.id !== rowId))
    setDeleteDialog({ open: false, row: null })
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/database/table/${selectedTable}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId }),
      })

      const result = await response.json()
      if (!result.success) {
        setData((prev) => [...prev, deleteDialog.row!])
        setError(result.error || "Не удалось удалить строку")
      }
    } catch (error) {
      setData((prev) => [...prev, deleteDialog.row!])
      setError(`Ошибка удаления строки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      console.error("[DatabaseViewer] Error deleting row:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Просмотр базы данных</h1>
        <p className="text-muted-foreground">Управление таблицами базы данных</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <Select value={selectedTable ?? ""} onValueChange={setSelectedTable} disabled={isLoading}>
          <SelectTrigger className="w-[300px]">
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

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Загрузка...
        </div>
      ) : selectedTable ? (
        <>
          <div
            ref={tableRef}
            className="rounded-md border overflow-x-auto cursor-grab select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ userSelect: isDragging ? "none" : "auto" }}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="min-w-[150px]">
                        <div className="flex items-center gap-1">
                          <div
                            onClick={header.column.getToggleSortingHandler()}
                            className="cursor-pointer flex items-center gap-1"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: "↑",
                              desc: "↓",
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        </div>
                        {header.column.getCanFilter() ? (
                          <div className="mt-1">{header.column.columnDef.meta?.filterComponent?.({ column: header.column })}</div>
                        ) : null}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="min-w-[150px]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                      Нет данных для отображения
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <span>Строк на странице:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Назад
              </Button>
              <span>
                Страница {table.getState().pagination.pageIndex + 1} из {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Вперед
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, row: open ? deleteDialog.row : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>Вы уверены, что хотите удалить эту строку? Это действие нельзя отменить.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, row: null })}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDeleteRow}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
