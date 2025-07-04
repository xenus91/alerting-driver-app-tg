import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Filter, X } from "lucide-react";

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
      <div className="space-y-2 py-2">
        {pendingFilterConditions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Нет активных фильтров
          </div>
        ) : (
          pendingFilterConditions.map((condition, index) => {
            const columnValues = distinctValues(condition.column);
            
            return (
              <div 
                key={index} 
                className="flex w-full items-center justify-between gap-2 px-3"
              >
                {index > 0 && (
                  <Select
                    value={condition.connector}
                    onValueChange={value => updateFilterCondition(index, 'connector', value)}
                    className="w-20"
                  >
                    <SelectTrigger className="h-7 text-xs px-2 py-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND" className="text-xs">И</SelectItem>
                      <SelectItem value="OR" className="text-xs">ИЛИ</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
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
                    <Input
                      value={Array.isArray(condition.value) 
                        ? condition.value.join(', ') 
                        : String(condition.value)}
                      onChange={e => {
                        const values = e.target.value.split(',')
                          .map(v => v.trim())
                          .filter(v => v);
                        updateFilterCondition(index, 'value', values);
                      }}
                      placeholder="Значения через запятую"
                      className="h-7 text-xs px-2 py-1"
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
