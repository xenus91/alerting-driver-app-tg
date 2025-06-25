-- Проверяем структуру таблицы trip_messages
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'trip_messages' 
ORDER BY ordinal_position;

-- Показываем пример данных
SELECT id, status, response_status, sent_at, response_at, created_at
FROM trip_messages 
LIMIT 5;
