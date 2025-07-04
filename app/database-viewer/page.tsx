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
import { useTable, useSortBy, useFilters, Column } from "react-table"

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
        setError("Error loading tables")
        console.error("Error fetching tables:", error)
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
          const response = await fetch(`/api/database/table/${selectedTable}`)
          const result = await response.json()
          if (result.success) {
            setData(result.data)
          } else {
            setError(result.error || `Failed to load data for table ${selectedTable}`)
          }
        } catch (error) {
          setError("Error loading table data")
          console.error(`Error fetching data for table ${selectedTable}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchTableData()
    }
  }, [selectedTable])

  // Определение столбцов для react-table
  const columns: Column<TableData>[] = useMemo(() => {
    if (!selectedTable || !tables.length) return []
    const tableSchema = tables.find((t) => t.name === selectedTable)
    if (!tableSchema) return []

    return [
      ...tableSchema.columns.map((col) => ({
        Header: col.name,
        accessor: col.name,
        Filter: ({ column }) => (
          <Input
            placeholder={`Filter ${col.name}`}
            value={(column.filterValue as string) || ""}
            onChange={(e) => column.setFilter(e.target.value || undefined)}
          />
        ),
        sortType: "basic",
      })),
      {
        Header: "Actions",
        id: "actions",
        Cell: ({ row }) => (
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
  }, [selectedTable, tables])

  // Инициализация react-table
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    setFilter,
  } = useTable(
    {
      columns,
      data,
      initialState: { sortBy: [] },
    },
    useFilters,
    useSortBy
  )

  // Обработчик сохранения изменений в ячейке
  const handleSaveEdit = async (row: TableData, column: string) => {
    if (!selectedTable) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/database/table/${selectedTable}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, column, value: editValue }),
      })
      const result = await response.json()
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
      setError("Error updating row")
      console.error("Error updating row:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Обработчик удаления строки
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
        setData((prev) => prev.filter((r) => r.id !== row.id))
      } else {
        setError(result.error || "Failed to delete row")
      }
    } catch (error) {
      setError("Error deleting row")
      console.error("Error deleting row:", error)
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

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <span className="animate-spin mr-2">⟳</span> Загрузка...
        </div>
      ) : selectedTable && data.length > 0 ? (
        <div className="border rounded-md">
          <Table {...getTableProps()}>
            <TableHeader>
              {headerGroups.map((headerGroup) => (
                <TableRow {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map((column) => (
                    <TableHead {...column.getHeaderProps(column.getSortByToggleProps())}>
                      {column.render("Header")}
                      {column.isSorted ? (column.isSortedDesc ? " ↓" : " ↑") : ""}
                      {column.canFilter ? <div>{column.render("Filter")}</div> : null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody {...getTableBodyProps()}>
              {rows.map((row) => {
                prepareRow(row)
                return (
                  <TableRow {...row.getRowProps()}>
                    {row.cells.map((cell) => (
                      <TableCell {...cell.getCellProps()}>
                        {cell.column.id === "actions" ? (
                          cell.render("Cell")
                        ) : editingCell?.row === row.index && editingCell?.column === cell.column.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editValue ?? cell.value}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(row.original, cell.column.id)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingCell({ row: row.index, column: cell.column.id })
                              setEditValue(cell.value)
                            }}
                            className="cursor-pointer"
                          >
                            {cell.value ?? "—"}
                          </div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : selectedTable ? (
        <p>Нет данных для отображения</p>
      ) : null}
    </div>
  )
}
