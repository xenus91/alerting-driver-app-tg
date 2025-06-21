-- Добавляем столбец role в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'driver';

-- Создаем индекс для быстрого поиска по роли
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Обновляем существующих пользователей, устанавливая роль driver
UPDATE users SET role = 'driver' WHERE role IS NULL;

-- Создаем таблицу для сессий (простая реализация без NextAuth)
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индекс для быстрого поиска сессий
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

-- Добавляем несколько операторов для тестирования (замените telegram_id на реальные)
-- INSERT INTO users (telegram_id, phone, name, first_name, last_name, full_name, role, registration_state) 
-- VALUES 
--   (123456789, '79000000001', 'Админ Тестовый', 'Админ', 'Тестовый', 'Админ Тестовый', 'operator', 'completed'),
--   (987654321, '79000000002', 'Оператор Главный', 'Оператор', 'Главный', 'Оператор Главный', 'operator', 'completed')
-- ON CONFLICT (telegram_id) DO UPDATE SET role = EXCLUDED.role;

COMMENT ON COLUMN users.role IS 'Роль пользователя: driver - водитель, operator - оператор';
COMMENT ON TABLE user_sessions IS 'Сессии пользователей для аутентификации';
