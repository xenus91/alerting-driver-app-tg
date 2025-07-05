// Добавьте в начало компонента FilterBlock
const [distinctValuesMap, setDistinctValuesMap] = useState<Record<string, string[]>>({});
const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>({});

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

// В обработчике изменения колонки добавьте вызов fetchDistinctValues
const handleColumnChange = (index: number, value: string) => {
  updateFilterCondition(index, 'column', value);
  fetchDistinctValues(value);
};

// В обработчике изменения оператора для in/not in
const handleOperatorChange = (index: number, value: string) => {
  updateFilterCondition(index, 'operator', value);
  
  if (value === "in" || value === "not in") {
    const column = pendingFilterConditions[index].column;
    if (column) {
      fetchDistinctValues(column);
    }
  }
};
