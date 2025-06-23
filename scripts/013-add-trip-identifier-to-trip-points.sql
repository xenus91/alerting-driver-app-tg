-- Добавляем поле trip_identifier в таблицу trip_points
ALTER TABLE trip_points 
ADD COLUMN trip_identifier VARCHAR(255);

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_trip_points_trip_identifier ON trip_points(trip_identifier);

-- Обновляем существующие записи (если есть)
-- Это временное решение, так как мы не можем точно определить связь
-- В будущем это поле будет заполняться при создании trip_points
