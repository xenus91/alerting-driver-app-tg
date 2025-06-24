-- Добавляем координаты к пунктам
ALTER TABLE points 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Добавляем координаты для существующих пунктов (примерные координаты Москвы)
UPDATE points SET latitude = 55.753930, longitude = 37.620795 WHERE point_id = '8117';
UPDATE points SET latitude = 55.729790, longitude = 37.601111 WHERE point_id = '8123';
UPDATE points SET latitude = 55.710000, longitude = 37.559167 WHERE point_id = '0124';
UPDATE points SET latitude = 55.749602, longitude = 37.539700 WHERE point_id = '0029';

-- Добавляем индексы для быстрого поиска по координатам
CREATE INDEX idx_points_coordinates ON points(latitude, longitude);
