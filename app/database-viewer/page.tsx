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
  Plus,
  Check
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
  columns: { name: string; type: string ; enumValues?: string[];}[]
}

const NULL_PLACEHOLDER = "__NULL__";

// Компонент для рендера ячейки с поддержкой разных типов данных
const TableCellRenderer = ({
  value,
  columnType,
  columnName,
  tableSchema,
  isEditing,
  onEditChange,
  onSave,
  onCancel
}: {
  value: any;
  columnType: string;
  columnName: string;
  tableSchema: TableSchema | undefined;
  isEditing: boolean;
  onEditChange: (value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  // Проверяем, является ли тип колонки временной меткой
  const isTimestampType = columnType.includes('timestamp') || 
                         columnType.includes('timestamptz') || 
                         columnType.includes('datetime') || 
                         columnType.includes('date') ||
                         columnType.includes('time');
  
  // Проверяем, является ли тип колонки boolean
  const isBooleanType = columnType === 'boolean' || columnType === 'bool';
  
  // Проверяем, является ли тип колонки enum
  const isEnumType = columnType === 'USER-DEFINED' || 
                    columnType.includes('enum') || 
                    columnType === 'trip_messages_status';

  // Получаем значения enum из схемы таблицы
  const enumValues = useMemo(() => {
    if (!tableSchema) return [];
    
    const column = tableSchema.columns.find(c => c.name === columnName);
    return column?.enumValues || [];
  }, [tableSchema, columnName]);

  // Функция для преобразования даты в формат для datetime-local
  const toDateTimeLocal = (dateString: string) => {
    if (!dateString) return "";
    
    let date: Date;
    
    // Пробуем разные форматы даты
    if (dateString.includes('T')) {
      // ISO формат
      date = new Date(dateString);
    } else if (dateString.includes(' ')) {
      // Формат с пробелом: YYYY-MM-DD HH:mm:ss
      date = new Date(dateString.replace(' ', 'T'));
    } else {
      // Пробуем парсить как есть
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return "";
    }
    
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
    // Режим редактирования для временных меток
    if (isTimestampType) {
      const localValue = toDateTimeLocal(value);
      
      return (
        <div className="flex gap-2 items-center">
          <Input
            type="datetime-local"
            value={localValue}
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
    
    // Режим редактирования для boolean
    if (isBooleanType) {
      return (
        <div className="flex gap-2 items-center">
          <Select
            value={String(value)}
            onValueChange={val => onEditChange(val === 'true')}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Выберите значение" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Да</SelectItem>
              <SelectItem value="false">Нет</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onSave}>
            <Save className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    
    // Режим редактирования для enum
    if (isEnumType) {
      if (enumValues.length > 0) {
        return (
          <div className="flex gap-2 items-center">
            <Select
              value={value || ''}
              onValueChange={onEditChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Выберите значение" />
              </SelectTrigger>
              <SelectContent>
                {enumValues.map(val => (
                  <SelectItem key={val} value={val}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onSave}>
              <Save className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }

    // Стандартный режим редактирования
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

  // Отображение временных меток
  if (isTimestampType) {
    try {
      let dateValue: Date;
      
      if (typeof value === "string") {
        if (value.includes('T')) {
          dateValue = parseISO(value);
        } else {
          // Пробуем разные форматы
          dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            dateValue = parseISO(value.replace(' ', 'T'));
          }
        }
      } else {
        dateValue = new Date(value);
      }
      
      if (isNaN(dateValue.getTime())) {
        throw new Error("Invalid date format");
      }
      
      return <span>{format(dateValue, "dd.MM.yyyy HH:mm", { locale: ru })}</span>;
    } catch (e) {
      return <span>{String(value)}</span>;
    }
  }
  
  // Отображение boolean значений
  if (isBooleanType) {
    return <span>{value ? 'Да' : 'Нет'}</span>;
  }

  // Стандартное отображение
  return <span>{String(value)}</span>;
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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; rowIds: string[] }>({ 
    open: false, 
    rowIds: [] 
  })
  
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
          // Сбрасываем выделение при загрузке новых данных
          setSelectedRows({});
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
    setSelectedRows({});
  }, [selectedTable]);

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
    setSelectedRows({});
  }, []);

  const applyFilters = useCallback(() => {
    setFilterConditions(pendingFilterConditions);
    setPageIndex(0);
    setSelectedRows({});
  }, [pendingFilterConditions]);

  // Выделение/снятие выделения со всех строк
  const toggleSelectAll = () => {
    if (Object.keys(selectedRows).length === data.length) {
      setSelectedRows({});
    } else {
      const newSelection: Record<string, boolean> = {};
      data.forEach(row => {
        newSelection[row.id] = true;
      });
      setSelectedRows(newSelection);
    }
  };

  // Выделение/снятие выделения одной строки
  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const newSelection = { ...prev };
      if (newSelection[rowId]) {
        delete newSelection[rowId];
      } else {
        newSelection[rowId] = true;
      }
      return newSelection;
    });
  };

  // Обработка удаления выбранных строк
  const handleDeleteSelected = async () => {
    if (!selectedTable || Object.keys(selectedRows).length === 0) return;

    const rowIds = Object.keys(selectedRows);
    setDeleteDialog({ open: true, rowIds });
  };

  // Подтверждение удаления выбранных строк
  const confirmDeleteSelected = async () => {
    if (!selectedTable || deleteDialog.rowIds.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/database/table/${selectedTable}/delete-multiple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deleteDialog.rowIds }),
      });

      const result = await response.json();
      if (result.success) {
        // Удаляем строки из данных
        setData(prev => prev.filter(row => !deleteDialog.rowIds.includes(row.id)));
        setTotalRows(prev => prev - deleteDialog.rowIds.length);
        setSelectedRows({});
      } else {
        setError(result.error || "Не удалось удалить строки");
      }
    } catch (error) {
      setError(`Ошибка удаления: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`);
    } finally {
      setIsLoading(false);
      setDeleteDialog({ open: false, rowIds: [] });
    }
  };

  // Создание колонок для таблицы
  const columns = useMemo<ColumnDef<TableData>[]>(() => {
    if (!selectedTable || tables.length === 0) return [];

    const tableSchema = tables.find(t => t.name === selectedTable);
    if (!tableSchema) return [];

    return tableSchema.columns.map(col => ({
      id: col.name,
      accessorKey: col.name,
      header: col.name,
      meta: { type: col.type },
      cell: () => null
    }));
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

      {/* Компактная строка управления */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Выбор таблицы - занимает больше места */}
        <div className="min-w-[200px] flex-1">
          <Select value={selectedTable ?? ""} onValueChange={setSelectedTable} disabled={isLoading}>
            <SelectTrigger className="w-full">
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
        </div>

        {/* Группа компактных кнопок */}
        <div className="flex items-center gap-2">
          {/* Управление колонками - только иконка */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                title="Управление колонками"
              >
                <Columns className="h-4 w-4" />
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

          {/* Фильтры - компактный блок */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                title="Фильтры"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] max-w-[90vw]">
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
            </PopoverContent>
          </Popover>

          {/* Кнопка удаления выбранных - компактная */}
          {Object.keys(selectedRows).length > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleDeleteSelected}
              className="whitespace-nowrap"
              size="sm"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Удалить ({Object.keys(selectedRows).length})
            </Button>
          )}
        </div>
      </div>

      {/* Остальной код без изменений */}
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
                    {/* Колонка с чекбоксом для выделения всех */}
                    <TableHead className="w-12">
                      <button 
                        onClick={toggleSelectAll}
                        className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 hover:bg-gray-100"
                        title="Выделить все"
                      >
                        {Object.keys(selectedRows).length === data.length && data.length > 0 && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </button>
                    </TableHead>
                    
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
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map(row => {
                    const tableSchema = tables.find(t => t.name === selectedTable);
                    if (!tableSchema) return null;
                    
                    return (
                      <TableRow key={row.id}>
                        {/* Чекбокс для выделения строки */}
                        <TableCell>
                          <button 
                            onClick={() => toggleRowSelection(row.original.id)}
                            className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 hover:bg-gray-100"
                          >
                            {selectedRows[row.original.id] && (
                              <Check className="h-4 w-4 text-blue-600" />
                            )}
                          </button>
                        </TableCell>
                        
                        {row.getVisibleCells().map(cell => {
                          const columnId = cell.column.id;
                          const columnDef = columns.find(col => col.accessorKey === columnId);
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
                                  columnName={columnId}
                                  tableSchema={tableSchema}
                                  isEditing={isEditing}
                                  onEditChange={setEditValue}
                                  onSave={() => handleSaveEdit(row.original, columnId)}
                                  onCancel={() => setEditingCell(null)}
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
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

      {/* Диалог подтверждения удаления выбранных строк */}
      <Dialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ open, rowIds: open ? deleteDialog.rowIds : [] })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить выбранные строки? Это действие нельзя отменить.
              <br />
              <span className="font-medium">Количество: {deleteDialog.rowIds.length}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, rowIds: [] })}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSelected}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
