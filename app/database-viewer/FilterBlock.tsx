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

interface FilterCondition {
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

export function FilterBlock({
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

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Фильтры
          {pendingFilterConditions.length > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {pendingFilterConditions.length}
            </span>
          )}
        </h4>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={addFilterCondition}
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить фильтр
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={clearAllFilters}
            disabled={pendingFilterConditions.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Очистить все
          </Button>
        </div>
      </div>
      
      {pendingFilterConditions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Нет условий фильтрации. Нажмите "Добавить фильтр", чтобы создать условие.
        </p>
      ) : (
        <div className="space-y-3">
          {pendingFilterConditions.map((condition, index) => {
            const columnValues = distinctValues(condition.column);
            
            return (
              <div key={index} className="flex items-center gap-2 p-3 border rounded bg-muted/50">
                {/* Оператор связи (не показываем для первого условия) */}
                {index > 0 && (
                  <Select
                    value={condition.connector}
                    onValueChange={value => updateFilterCondition(index, 'connector', value)}
                    className="w-20"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">И</SelectItem>
                      <SelectItem value="OR">ИЛИ</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                <Select
                  value={condition.column}
                  onValueChange={value => updateFilterCondition(index, 'column', value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Колонка" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.find(t => t.name === selectedTable)?.columns.map(col => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={condition.operator}
                  onValueChange={value => updateFilterCondition(index, 'operator', value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Оператор" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {['in', 'not in'].includes(condition.operator) ? (
                  <Select
                    value={Array.isArray(condition.value) ? condition.value : []}
                    onValueChange={(values) => updateFilterCondition(index, 'value', values)}
                    multiple
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="Выберите значения" />
                    </SelectTrigger>
                    <SelectContent>
                      {columnValues.map(value => (
                        <SelectItem 
                          key={value} 
                          value={value}
                          disabled={value === ""}
                        >
                          {value === NULL_PLACEHOLDER ? "[пусто]" : value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={String(condition.value)}
                    onChange={e => updateFilterCondition(index, 'value', e.target.value)}
                    placeholder="Значение"
                    className="w-60"
                  />
                )}
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeFilterCondition(index)}
                  title="Удалить условие"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="secondary"
              onClick={clearAllFilters}
              disabled={pendingFilterConditions.length === 0}
            >
              Сбросить
            </Button>
            <Button 
              onClick={applyFilters}
              disabled={pendingFilterConditions.length === 0}
            >
              Применить фильтры
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
