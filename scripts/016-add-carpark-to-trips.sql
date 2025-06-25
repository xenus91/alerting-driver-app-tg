-- Добавляем поле carpark в таблицу trips
ALTER TABLE trips ADD COLUMN carpark VARCHAR(50);

-- Создаем индекс для оптимизации запросов по carpark
CREATE INDEX IF NOT EXISTS idx_trips_carpark ON trips(carpark);

-- Обновляем существующие записи trips, устанавливая carpark на основе пользователей из trip_messages
UPDATE trips 
SET carpark = (
    SELECT DISTINCT u.carpark 
    FROM trip_messages tm 
    JOIN users u ON tm.telegram_id = u.telegram_id 
    WHERE tm.trip_id = trips.id 
    AND u.carpark IS NOT NULL 
    LIMIT 1
)
WHERE carpark IS NULL;
