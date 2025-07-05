"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  Loader2, 
  Trash2, 
  Save, 
  X, 
  AlertTriangle, 
  Columns, 
  Plus
} from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  flexRender,
  VisibilityState,
  Row,
} from "@tanstack/react-table"
import FilterBlock, { FilterCondition } from "@/components/filter-block"
import { format, parseISO } from "date-fns"
import { ru } from "date-fns/locale"

interface TableData {
  [key: string]: any
}

interface TableSchema {
  name: string
  columns: { name: string; type: string }[]
}

const NULL_PLACEHOLDER = "__NULL__";

// Компонент для рендера ячейки с поддержкой разных типов данных
const TableCellRenderer = ({
  value,
  columnType,
  isEditing,
  onEditChange,
  onSave,
  onCancel
}: {
  value: any;
  columnType: string;
  isEditing: boolean;
  onEditChange: (value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  // Функция для преобразования даты в формат для datetime-local
  const toDateTimeLocal = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  // Функция для преобразования обратно в ISO строку
  const fromDateTimeLocal = (localString: string) => {
    if (!localString) return null;
    return new Date(localString).toISOString();
  };

  if (isEditing) {
    if (columnType === "timestamp") {
      return (
        <div className="flex gap-2 items-center">
          <Input
            type="datetime-local"
            value={toDateTimeLocal(value)}
            onChange={e => onEditChange(fromDateTimeLocal(e.target.value))}
            className="w-48 h-8"
            autoFocus
          />
          <Button size="sm" onClick={onSave}>
            <Save className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-2 items-center">
        <Input
          value={value || ""}
          onChange={e => onEditChange(e.target.value)}
          className="w-48 h-8"
          autoFocus
        />
        <Button size="sm" onClick={onSave}>
          <Save className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Отображение без редактирования
  if (value === null || value === undefined) {
    return <span>—</span>;
  }

  if (columnType === "timestamp") {
    try {
      const dateValue = typeof value === "string" ? parseISO(value) : new Date(value);
      return <span>{format(dateValue, "dd.MM.yyyy HH:mm", { locale: ru })}</span>;
    } catch (e) {
      return <span>Неверный формат</span>;
    }
  }

  return <span>{String(value)}</span>;
};

// Компонент для рендера строки таблицы
const TableRowRenderer = ({
  row,
  columns,
  tableSchema,
  editingCell,
  editValue,
  setEditingCell,
  setEditValue,
  handleSaveEdit,
  setDeleteDialog
}: {
  row: Row<TableData>;
  columns: any[];
  tableSchema: TableSchema | undefined;
  editingCell: { rowId: string; columnId: string } | null;
  editValue: any;
  setEditingCell: (cell: { rowId: string; columnId: string } | null) => void;
  setEditValue: (value: any) => void;
  handleSaveEdit: (row: TableData, columnId: string) => void;
  setDeleteDialog: (dialog: { open: boolean; row: TableData | null }) => void;
}) => {
  return (
    <TableRow key={row.id}>
      {row.getVisibleCells().map(cell => {
        const columnId = cell.column.id;
        const columnDef = columns.find((col: any) => col.accessorKey === columnId);
        const columnType = columnDef?.meta?.type || "text";
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === columnId;
        const value = isEditing ? editValue : cell.getValue();

        return (
          <TableCell key={cell.id} className="min-w-[150px]">
            <div
              className="cursor-pointer hover:bg-gray-100 p-2 rounded min-w-[100px]"
              onDoubleClick={() => {
                setEditingCell({ rowId: row.id, columnId });
                setEditValue(value);
              }}
            >
              <TableCellRenderer
                value={value}
                columnType={columnType}
                isEditing={isEditing}
                onEditChange={setEditValue}
                onSave={() => handleSaveEdit(row.original, columnId)}
                onCancel={() => setEditingCell(null)}
              />
            </div>
          </TableCell>
        );
      })}
      <TableCell>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialog({ open: true, row: row.original })}
          title="Удалить строку"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default function DatabaseViewer() {
  const [tables, setTables] = useState<TableSchema[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [data, setData] = useState<TableData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editValue, setEditValue] = useState<any>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalRows, setTotalRows] = useState(0)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; row: TableData | null }>({ open: false, row: null })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  
  // Состояния для фильтрации
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([])
  const [pendingFilterConditions, setPendingFilterConditions] = useState<FilterCondition[]>([
    { column: '', operator: '', value: '', connector: 'AND' }
  ]);

  // Проверка авторизации
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        const result = await response.json()
        if (!result.success || result.user?.role !== "admin") {
          setError("Access denied: Admin role required")
        }
      } catch (error) {
        setError(`Authentication error: ${error instanceof Error ? error.message : "Unknown error"}`)
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
        const response = await fetch("/api/database/tables", { cache: "no-store" })
        const result = await response.json()
        if (result.success) {
          setTables(result.tables)
        } else {
          setError(result.error || "Failed to load tables")
        }
      } catch (error) {
        setError(`Error loading tables: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTables()
  }, [])

  // Загрузка данных таблицы
  useEffect(() => {
    if (!selectedTable) return

    const fetchTableData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.append("offset", String(pageIndex * pageSize))
        params.append("limit", String(pageSize))
        
        // Добавляем сортировку
        if (sorting.length > 0) {
          params.append("sortBy", sorting[0].id)
          params.append("sortOrder", sorting[0].desc ? "DESC" : "ASC")
        }

        // Добавляем условия фильтрации
        filterConditions.forEach((condition, index) => {
          params.append(`filter[${index}].column`, condition.column)
          params.append(`filter[${index}].operator`, condition.operator)
          params.append(`filter[${index}].connector`, condition.connector)
          
          if (Array.isArray(condition.value)) {
            condition.value.forEach(val => {
              const realValue = val === NULL_PLACEHOLDER ? "" : val;
              params.append(`filter[${index}].value`, realValue)
            })
          } else {
            const realValue = condition.value === NULL_PLACEHOLDER ? "" : condition.value;
            params.append(`filter[${index}].value`, realValue)
          }
        })

        const response = await fetch(`/api/database/table/${selectedTable}?${params.toString()}`, { cache: "no-store" })
        const result = await response.json()
        
        if (result.success) {
          const transformedData = result.data.map((row: TableData) => {
            const newRow: TableData = {};
            Object.keys(row).forEach(key => {
              newRow[key] = row[key] === "" ? null : row[key];
            });
            return newRow;
          });
          
          setData(transformedData)
          setTotalRows(result.total || result.data.length)
        } else {
          setError(result.error || `Failed to load data for table ${selectedTable}`)
        }
      } catch (error) {
        setError(`Error loading table data: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTableData()
  }, [selectedTable, filterConditions, sorting, pageIndex, pageSize])

  // Получение уникальных значений для колонки
  const getDistinctValues = useCallback((columnId: string) => {
    const values = new Set<string>()
    data.forEach(row => {
      const value = row[columnId];
      if (value === null || value === undefined || value === "") {
        values.add(NULL_PLACEHOLDER);
      } else {
        values.add(String(value));
      }
    });
    return Array.from(values).sort();
  }, [data])

  // Сброс фильтров при смене таблицы
  useEffect(() => {
    setPendingFilterConditions([{ column: '', operator: '', value: '', connector: 'AND' }]);
    setFilterConditions([]);
    setPageIndex(0);
  }, [selectedTable]);

  useEffect(() => {
    console.log("Pending filter conditions updated:", pendingFilterConditions);
  }, [pendingFilterConditions]);

  // Обработка сохранения редактирования ячейки
  const handleSaveEdit = async (row: TableData, columnId: string) => {
    if (!selectedTable || editValue === null) return

    const originalValue = row[columnId]
    setData(prev => prev.map(r => r.id === row.id ? { ...r, [columnId]: editValue } : r))
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
        setData(prev => prev.map(r => r.id === row.id ? { ...r, [columnId]: originalValue } : r))
        setError(result.error || "Не удалось обновить строку")
      }
    } catch (error) {
      setData(prev => prev.map(r => r.id === row.id ? { ...r, [columnId]: originalValue } : r))
      setError(`Ошибка обновления строки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Обработка удаления строки
  const handleDeleteRow = async () => {
    if (!selectedTable || !deleteDialog.row) return

    const rowId = deleteDialog.row.id
    setData(prev => prev.filter(r => r.id !== rowId))
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
        setData(prev => [...prev, deleteDialog.row!])
        setError(result.error || "Не удалось удалить строку")
      }
    } catch (error) {
      setData(prev => [...prev, deleteDialog.row!])
      setError(`Ошибка удаления строки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Функции для управления фильтрами
  const addFilterCondition = useCallback(() => {
    setPendingFilterConditions(prev => [
      ...prev,
      { column: "", operator: "", value: "", connector: "AND" }
    ]);
  }, []);

  const updateFilterCondition = useCallback((
    index: number, 
    field: keyof FilterCondition, 
    value: any
  ) => {
    setPendingFilterConditions(prev => {
      const newConditions = [...prev];
      const condition = { ...newConditions[index] };
      
      // Обработка для операторов списка
      if (field === 'operator' && (value === 'in' || value === 'not in')) {
        condition.value = [];
      }
      
      condition[field] = value;
      newConditions[index] = condition;
      return newConditions;
    });
  }, []);

  const removeFilterCondition = useCallback((index: number) => {
    setPendingFilterConditions(prev => {
      if (prev.length === 1) {
        // Если удаляем последний элемент - возвращаем пустой блок
        return [{ column: '', operator: '', value: '', connector: 'AND' }];
      }
      
      const newConditions = [...prev];
      newConditions.splice(index, 1);
      
      // Обновляем коннекторы для оставшихся условий
      if (index < newConditions.length) {
        if (index === 0 && newConditions.length > 0) {
          newConditions[0].connector = "AND";
        } else if (index > 0) {
          newConditions[index].connector = newConditions[index - 1].connector;
        }
      }
      
      return newConditions;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setPendingFilterConditions([{ column: '', operator: '', value: '', connector: 'AND' }]);
    setFilterConditions([]);
    setPageIndex(0);
  }, []);

  const applyFilters = useCallback(() => {
    setFilterConditions(pendingFilterConditions);
    setPageIndex(0);
  }, [pendingFilterConditions]);

// Создание колонок для таблицы
const columns = useMemo<ColumnDef<TableData>[]>(() => {
  if (!selectedTable || tables.length === 0) return [];

  const tableSchema = tables.find(t => t.name === selectedTable);
  if (!tableSchema) return [];

  console.log("Creating columns for table:", selectedTable);
  
  return tableSchema.columns.map(col => {
    console.log(`Column: ${col.name}, type: ${col.type}`);
    return {
      accessorKey: col.name,
      header: col.name,
      meta: { type: col.type },
      cell: () => null
    };
  });
}, [selectedTable, tables]);

  const table = useReactTable({
    data,
    columns,
    state: { 
      columnVisibility,
      sorting,
      pagination: { pageIndex, pageSize } 
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const newState = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater
      setPageIndex(newState.pageIndex)
      setPageSize(newState.pageSize)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalRows / pageSize),
  })

  return (
    <div className="space-y-4 p-4">
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
            {tables.map(table => (
              <SelectItem key={table.name} value={table.name}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Columns className="mr-2 h-4 w-4" />
              Колонки
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60">
            <div className="space-y-2">
              <h4 className="font-medium">Видимые колонки</h4>
              {table.getAllLeafColumns().map(column => (
                <div key={column.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    className="w-4 h-4"
                  />
                  <label className="text-sm font-medium leading-none">
                    {column.id}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Блок фильтрации */}
      {selectedTable && (
        <FilterBlock
          tables={tables}
          selectedTable={selectedTable}
          pendingFilterConditions={pendingFilterConditions}
          distinctValues={getDistinctValues}
          addFilterCondition={addFilterCondition}
          updateFilterCondition={updateFilterCondition}
          removeFilterCondition={removeFilterCondition}
          clearAllFilters={clearAllFilters}
          applyFilters={applyFilters}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Загрузка...
        </div>
      ) : selectedTable ? (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
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
                      </TableHead>
                    ))}
                    <TableHead className="w-[100px]">Действия</TableHead>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map(row => {
                    const tableSchema = tables.find(t => t.name === selectedTable);
                    
                    return (
                      <TableRowRenderer
                        key={row.id}
                        row={row}
                        columns={columns}
                        tableSchema={tableSchema}
                        editingCell={editingCell}
                        editValue={editValue}
                        setEditingCell={setEditingCell}
                        setEditValue={setEditValue}
                        handleSaveEdit={handleSaveEdit}
                        setDeleteDialog={setDeleteDialog}
                      />
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.getAllColumns().length + 1} className="h-24 text-center">
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
                onValueChange={value => setPageSize(Number(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50].map(size => (
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

      <Dialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ open, row: open ? deleteDialog.row : null })}>
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
