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
import { Trash2, Save, AlertTriangle, Loader2 } from "lucide-react"
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
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editValue, setEditValue] = useState<any>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  // Проверка авторизации
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me")
        const result = await response.json()
        if (!result.success || result.user?.role !== "admin") {
          setError("Access denied: Admin role required")
        }
      } catch (error) {
        setError(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        const response = await fetch("/api/database/tables")
        const result = await response.json()
        if (result.success) {
          setTables(result.tables)
        } else {
          setError(result.error || "Failed to load tables")
        }
      } catch (error) {
        setError(`Error loading tables: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTables()
  }, [])

  // Загрузка данных выбранной таблицы
  useEffect(() => {
    if (!selectedTable) return

    const fetchTableData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        const validColumns = tables.find(t => t.name === selectedTable)?.columns.map(c => c.name) || []
        
        columnFilters.forEach(filter => {
          if (validColumns.includes(filter.id)) {
            params.append(filter.id, String(filter.value))
          }
        })

        if (sorting.length > 0 && validColumns.includes(sorting[0].id)) {
          params.append("sortBy", sorting[0].id)
          params.append("sortOrder", sorting[0].desc ? "DESC" : "ASC")
        }

        const response = await fetch(`/api/database/table/${selectedTable}?${params.toString()}`)
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || `Failed to load data for table ${selectedTable}`)
        }
      } catch (error) {
        setError(`Error loading table data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTableData()
  }, [selectedTable, columnFilters, sorting, tables])

  const columns = useMemo<ColumnDef<TableData>[]>(() => {
    if (!selectedTable || tables.length === 0) return []
    
    const tableSchema = tables.find(t => t.name === selectedTable)
    if (!tableSchema) return []

    const baseColumns: ColumnDef<TableData>[] = tableSchema.columns.map(col => ({
      accessorKey: col.name,
      header: col.name,
      cell: ({ row, column }) => {
        const value = row.getValue(column.id)
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id

        return isEditing ? (
          <div className="flex gap-2 items-center">
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
              setEditingCell({ rowId: row.id, columnId: column.id })
              setEditValue(value)
            }}
            className="cursor-pointer hover:bg-gray-100 p-2 rounded"
          >
            {value !== null && value !== undefined ? String(value) : "—"}
          </div>
        )
      },
    }))

    // Добавляем колонку с действиями
    baseColumns.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDeleteRow(row.original)}
          title="Delete row"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    })

    return baseColumns
  }, [selectedTable, tables, editingCell, editValue])

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const handleSaveEdit = async (row: TableData, columnId: string) => {
    if (!selectedTable || editValue === null) return
    
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/database/table/${selectedTable}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: row.id, 
          column: columnId, 
          value: editValue 
        }),
      })

      const result = await response.json()
      if (result.success) {
        setData(prev => prev.map(r => 
          r.id === row.id ? { ...r, [columnId]: editValue } : r
        ))
        setEditingCell(null)
      } else {
        setError(result.error || "Failed to update row")
      }
    } catch (error) {
      setError(`Error updating row: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRow = async (row: TableData) => {
    if (!selectedTable || !confirm("Are you sure you want to delete this row?")) return
    
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/database/table/${selectedTable}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      })

      const result = await response.json()
      if (result.success) {
        setData(prev => prev.filter(r => r.id !== row.id))
      } else {
        setError(result.error || "Failed to delete row")
      }
    } catch (error) {
      setError(`Error deleting row: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Database Viewer</h1>
        <p className="text-muted-foreground">Manage your database tables</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <Select 
          value={selectedTable ?? ""} 
          onValueChange={setSelectedTable}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map(table => (
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
          Loading...
        </div>
      ) : selectedTable ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      <div 
                        onClick={header.column.getToggleSortingHandler()}
                        className="cursor-pointer flex items-center gap-1"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: "↑",
                          desc: "↓",
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                      {header.column.getCanFilter() ? (
                        <Input
                          placeholder={`Filter...`}
                          value={(header.column.getFilterValue() as string) ?? ""}
                          onChange={e => header.column.setFilterValue(e.target.value)}
                          className="mt-1 h-8"
                        />
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell 
                    colSpan={table.getAllColumns().length} 
                    className="h-24 text-center"
                  >
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
