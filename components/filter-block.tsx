import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Filter, X, Check } from "lucide-react";
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

// Компонент для множественного выбора с чекбоксами
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
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {options.map(option => (
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
            ))}
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

  const tableColumns = tables.find(t => t.name === selectedTable)?.columns || [];

  return (
    <div className="z-50 rounded-md border bg-overlay shadow-md p-0 w-full max-w-3xl">
      <div className="space-y-1 py-2">
        {pendingFilterConditions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Нет активных фильтров
          </div>
        ) : (
          pendingFilterConditions.map((condition, index) => {
            const columnValues = distinctValues(condition.column);
            const selectedValues = Array.isArray(condition.value) 
              ? condition.value 
              : [];
            
            return (
              <div key={index} className="space-y-1">
                {/* Коннектор между условиями */}
                {index > 0 && (
                  <div className="flex justify-center">
                    <Select
                      value={condition.connector}
                      onValueChange={value => updateFilterCondition(index, 'connector', value)}
                      className="w-24"
                    >
                      <SelectTrigger className="h-6 text-xs px-2 py-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND" className="text-xs">И</SelectItem>
                        <SelectItem value="OR" className="text-xs">ИЛИ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Условие фильтра */}
                <div className="flex w-full items-center justify-between gap-2 px-3">
                  <Select
                    value={condition.column}
                    onValueChange={value => updateFilterCondition(index, 'column', value)}
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
                    onValueChange={value => updateFilterCondition(index, 'operator', value)}
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
                    {['in', 'not in'].includes(condition.operator) ? (
                      <MultiSelect
                        options={columnValues}
                        selected={selectedValues}
                        onSelect={(values) => updateFilterCondition(index, 'value', values)}
                        placeholder="Выберите значения"
                      />
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
