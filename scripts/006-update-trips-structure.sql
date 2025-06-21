-- Обновляем структуру таблицы trips
ALTER TABLE trips 
DROP COLUMN IF EXISTS loading_point,
DROP COLUMN IF EXISTS unloading_point;

-- Добавляем новые поля для точек
ALTER TABLE trips 
ADD COLUMN point_type VARCHAR(1) CHECK (point_type IN ('P', 'D')),
ADD COLUMN point_id INTEGER,
ADD COLUMN point_num INTEGER,
ADD COLUMN point_name VARCHAR(255);

-- Создаем таблицу пунктов
CREATE TABLE IF NOT EXISTS points (
    id SERIAL PRIMARY KEY,
    point_name VARCHAR(255) NOT NULL,
    door_open_1 VARCHAR(50),
    door_open_2 VARCHAR(50),
    door_open_3 VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем индексы
CREATE INDEX IF NOT EXISTS idx_trips_point_type ON trips(point_type);
CREATE INDEX IF NOT EXISTS idx_trips_point_id ON trips(point_id);
CREATE INDEX IF NOT EXISTS idx_points_name ON points(point_name);

-- Добавляем внешний ключ
ALTER TABLE trips 
ADD CONSTRAINT fk_trips_point_id 
FOREIGN KEY (point_id) REFERENCES points(id) ON DELETE SET NULL;
