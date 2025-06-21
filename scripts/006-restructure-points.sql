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

-- Создаем индекс для быстрого поиска по названию
CREATE INDEX IF NOT EXISTS idx_points_name ON points(point_name);

-- Создаем таблицу маршрутных точек для рейсов
CREATE TABLE IF NOT EXISTS trip_points (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  point_id INTEGER REFERENCES points(id) ON DELETE CASCADE,
  point_type CHAR(1) NOT NULL CHECK (point_type IN ('P', 'D')), -- P = погрузка, D = разгрузка
  point_num INTEGER NOT NULL, -- порядковый номер остановки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для trip_points
CREATE INDEX IF NOT EXISTS idx_trip_points_trip_id ON trip_points(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_points_point_id ON trip_points(point_id);
CREATE INDEX IF NOT EXISTS idx_trip_points_type_num ON trip_points(point_type, point_num);

-- Удаляем старые поля из trips
ALTER TABLE trips DROP COLUMN IF EXISTS loading_points;
ALTER TABLE trips DROP COLUMN IF EXISTS unloading_points;

-- Удаляем старые поля из trip_messages
ALTER TABLE trip_messages DROP COLUMN IF EXISTS loading_points;
ALTER TABLE trip_messages DROP COLUMN IF EXISTS unloading_points;

-- Добавляем несколько примеров пунктов
INSERT INTO points (point_name, door_open_1, door_open_2, door_open_3) VALUES
('Склад №1 (Москва)', '08:00-18:00', '19:00-22:00', NULL),
('Терминал Домодедово', '06:00-23:00', NULL, NULL),
('Распределительный центр СПб', '09:00-17:00', '18:00-21:00', '22:00-02:00'),
('Склад Екатеринбург', '08:00-20:00', NULL, NULL),
('Терминал Новосибирск', '07:00-19:00', '20:00-23:00', NULL)
ON CONFLICT DO NOTHING;
