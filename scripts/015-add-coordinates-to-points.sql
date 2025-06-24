-- Добавляем поля координат к таблице points
ALTER TABLE points 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Добавляем комментарии для понимания
COMMENT ON COLUMN points.latitude IS 'Широта точки в десятичных градусах';
COMMENT ON COLUMN points.longitude IS 'Долгота точки в десятичных градусах';
