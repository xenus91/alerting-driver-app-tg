import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Filter, X, Check, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const OPERATORS = [
  { value: "=", label: "Равно" },
  { value: "!=", label: "Не равно" },
  { value: ">", label: "Больше" },
  { value: "<", label: "Меньше" },
  { value: ">=", label: "Больше или равно" },
  { value: "<=", label: "Меньше или равно" },
  { value: "in", label: "В списке" },
  { value: "not in", label: "Не в списке" },
  { value: "like", label: "Содержит" },
];

const NULL_PLACEHOLDER = "__NULL__";

export interface FilterCondition {
  column: string;
  operator: string;
  value: string | string[];
  connector: "AND" | "OR";
}

interface FilterBlockProps {
  tables: { name: string; columns: { name: string; type: string }[] }[];
  selectedTable: string | null;
  pendingFilterConditions: FilterCondition[];
  distinctValues: (columnId: string) => string[];
  addFilterCondition: () => void;
  updateFilterCondition: (index: number, field: keyof FilterCondition, value: any) => void;
  removeFilterCondition: (index: number) => void;
  clearAllFilters: () => void;
  applyFilters: () => void;
}

const MultiSelect = ({ 
  options, 
  selected, 
  onSelect,
  placeholder = "Выберите значения"
}: {
  options: string[];
  selected: string[];
  onSelect: (values: string[]) => void;
  placeholder?: string;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Фильтрация опций по поисковому запросу
  const filteredOptions = options.filter(option => 
    option.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option === NULL_PLACEHOLDER && "[пусто]".includes(searchTerm.toLowerCase()))
  );

  const toggleValue = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onSelect(newSelected);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="h-7 text-xs px-2 py-1 w-full justify-between"
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map(value => (
                <Badge 
                  key={value} 
                  variant="secondary"
                  className="text-xs px-1 h-5"
                >
                  {value === NULL_PLACEHOLDER ? "[пусто]" : value}
                </Badge>
              ))
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1">
        <div className="p-2">
          <Input
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 text-xs mb-1"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div 
                  key={option} 
                  className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => toggleValue(option)}
                >
                  <div className="flex items-center justify-center w-4 h-4 border rounded">
                    {selected.includes(option) && <Check className="h-3 w-3" />}
                  </div>
                  <Label className="text-sm cursor-pointer">
                    {option === NULL_PLACEHOLDER ? "[пусто]" : option}
                  </Label>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Ничего не найдено
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default function FilterBlock({
  tables,
  selectedTable,
  pendingFilterConditions,
  distinctValues,
  addFilterCondition,
  updateFilterCondition,
  removeFilterCondition,
  clearAllFilters,
  applyFilters,
}: FilterBlockProps) {
  if (!selectedTable) return null;

  const [distinctValuesMap, setDistinctValuesMap] = useState<Record<string, string[]>>({});
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>({});
  const tableColumns = tables.find(t => t.name === selectedTable)?.columns || [];

  // Функция для загрузки уникальных значений
  const fetchDistinctValues = async (column: string) => {
    if (!selectedTable || distinctValuesMap[column]) return;
    
    setLoadingColumns(prev => ({ ...prev, [column]: true }));
    
    try {
      const response = await fetch(
        `/api/database/table/${selectedTable}/distinct?column=${column}`
      );
      const result = await response.json();
      
      if (result.success) {
        setDistinctValuesMap(prev => ({
          ...prev,
          [column]: result.data
        }));
      }
    } catch (error) {
      console.error("Failed to fetch distinct values:", error);
    } finally {
      setLoadingColumns(prev => ({ ...prev, [column]: false }));
    }
  };

  // Обработчики изменений
  const handleColumnChange = (index: number, value: string) => {
    updateFilterCondition(index, 'column', value);
    fetchDistinctValues(value);
  };

  const handleOperatorChange = (index: number, value: string) => {
    updateFilterCondition(index, 'operator', value);
    
    if (value === "in" || value === "not in") {
      const column = pendingFilterConditions[index].column;
      if (column) {
        fetchDistinctValues(column);
      }
    }
  };

  return (
    <div className="z-50 rounded-md border bg-overlay shadow-md p-0 w-full max-w-3xl">
      <div className="space-y-2 py-2">
        {pendingFilterConditions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Нет активных фильтров
          </div>
        ) : (
          pendingFilterConditions.map((condition, index) => {
            const selectedValues = Array.isArray(condition.value) 
              ? condition.value 
              : [];
            
            return (
              <div key={index} className="space-y-2">
                {/* Условие фильтра */}
                <div className="flex w-full items-center justify-between gap-2 px-3">
                  <Select
                    value={condition.column}
                    onValueChange={value => handleColumnChange(index, value)}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs px-2 py-1">
                      <SelectValue placeholder="Колонка" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {tableColumns.map(col => (
                        <SelectItem 
                          key={col.name} 
                          value={col.name}
                          className="text-xs"
                        >
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={condition.operator}
                    onValueChange={value => handleOperatorChange(index, value)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs px-2 py-1">
                      <SelectValue placeholder="Оператор" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(op => (
                        <SelectItem 
                          key={op.value} 
                          value={op.value}
                          className="text-xs"
                        >
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex-1">
                    {condition.operator === "in" || condition.operator === "not in" ? (
                      loadingColumns[condition.column] ? (
                        <div className="flex items-center justify-center h-7 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Загрузка...
                        </div>
                      ) : (
                        <MultiSelect
                          options={distinctValuesMap[condition.column] || []}
                          selected={selectedValues}
                          onSelect={(values) => updateFilterCondition(index, 'value', values)}
                          placeholder="Выберите значения"
                        />
                      )
                    ) : (
                      <Input
                        value={String(condition.value)}
                        onChange={e => updateFilterCondition(index, 'value', e.target.value)}
                        placeholder="Значение"
                        className="h-7 text-xs px-2 py-1"
                      />
                    )}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeFilterCondition(index)}
                    title="Удалить условие"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                {/* Коннектор для следующего условия */}
                {index < pendingFilterConditions.length - 1 && (
                  <div className="flex justify-center px-3">
                    <div className="flex items-center space-x-2 bg-muted rounded-full p-1">
                      <Button
                        variant={pendingFilterConditions[index + 1].connector === "AND" ? "default" : "ghost"}
                        size="sm"
                        className={`h-6 text-xs px-2 rounded-full ${
                          pendingFilterConditions[index + 1].connector === "AND" 
                            ? "bg-primary text-primary-foreground" 
                            : ""
                        }`}
                        onClick={() => updateFilterCondition(index + 1, "connector", "AND")}
                      >
                        И
                      </Button>
                      <Button
                        variant={pendingFilterConditions[index + 1].connector === "OR" ? "default" : "ghost"}
                        size="sm"
                        className={`h-6 text-xs px-2 rounded-full ${
                          pendingFilterConditions[index + 1].connector === "OR" 
                            ? "bg-primary text-primary-foreground" 
                            : ""
                        }`}
                        onClick={() => updateFilterCondition(index + 1, "connector", "OR")}
                      >
                        ИЛИ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      <div className="w-full h-px bg-border" />
      
      <div className="px-3 py-2 flex flex-row justify-between">
        <Button 
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2 py-1"
          onClick={addFilterCondition}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить фильтр
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2 py-1"
            onClick={clearAllFilters}
            disabled={pendingFilterConditions.length === 0}
          >
            Очистить
          </Button>
          <Button 
            size="sm"
            className="h-7 text-xs px-2 py-1"
            onClick={applyFilters}
            disabled={pendingFilterConditions.length === 0}
          >
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}
