-- Добавляем новые поля для пользователей
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS full_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS carpark VARCHAR(20);

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_carpark ON users(carpark);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);

-- Переименовываем campaigns в trips (рейсы)
ALTER TABLE campaigns RENAME TO trips;

-- Удаляем поле name из trips, оно нам не нужно
ALTER TABLE trips DROP COLUMN IF EXISTS name;

-- Добавляем новые поля для рейсов
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS trip_identifier VARCHAR(50),
ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS planned_loading_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS loading_points TEXT,
ADD COLUMN IF NOT EXISTS unloading_points TEXT,
ADD COLUMN IF NOT EXISTS driver_comment TEXT;

-- Переименовываем campaign_messages в trip_messages
ALTER TABLE campaign_messages RENAME TO trip_messages;

-- Переименовываем поле campaign_id в trip_id
ALTER TABLE trip_messages RENAME COLUMN campaign_id TO trip_id;

-- Добавляем новые поля для сообщений рейсов
ALTER TABLE trip_messages
ADD COLUMN IF NOT EXISTS trip_identifier VARCHAR(50),
ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS planned_loading_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS loading_points TEXT,
ADD COLUMN IF NOT EXISTS unloading_points TEXT,
ADD COLUMN IF NOT EXISTS driver_comment TEXT,
ADD COLUMN IF NOT EXISTS sent_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Создаем индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_trip_messages_trip_identifier ON trip_messages(trip_identifier);
CREATE INDEX IF NOT EXISTS idx_trip_messages_vehicle_number ON trip_messages(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_trip_messages_sent_time ON trip_messages(sent_time);

-- Обновляем существующие записи
UPDATE users SET full_name = COALESCE(first_name || ' ' || last_name, name) WHERE full_name IS NULL;
