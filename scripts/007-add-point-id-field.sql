-- Добавляем поле point_id в таблицу points
ALTER TABLE points ADD COLUMN IF NOT EXISTS point_id VARCHAR(20) UNIQUE;

-- Создаем индекс для быстрого поиска по point_id
CREATE INDEX IF NOT EXISTS idx_points_point_id ON points(point_id);

-- Обновляем существующие записи, добавляя point_id на основе id
UPDATE points SET point_id = 'P' || LPAD(id::text, 3, '0') WHERE point_id IS NULL;

-- Делаем поле point_id обязательным после заполнения существующих записей
ALTER TABLE points ALTER COLUMN point_id SET NOT NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN points.point_id IS 'Краткий номер пункта (например: P001, D001)';
