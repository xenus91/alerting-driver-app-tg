-- Добавляем тестовые пункты для примера
INSERT INTO points (point_id, point_name, door_open_1, door_open_2, door_open_3) VALUES
('8117', 'Склад Центральный', '08:00-12:00', '14:00-18:00', NULL),
('8123', 'Склад Северный', '09:00-17:00', NULL, NULL),
('0124', 'Магазин на Ленина', '10:00-20:00', NULL, NULL),
('0029', 'Магазин на Советской', '08:00-22:00', '22:00-06:00', NULL)
ON CONFLICT (point_id) DO UPDATE SET
  point_name = EXCLUDED.point_name,
  door_open_1 = EXCLUDED.door_open_1,
  door_open_2 = EXCLUDED.door_open_2,
  door_open_3 = EXCLUDED.door_open_3;
