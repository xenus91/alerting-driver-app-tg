-- Добавляем поле verified в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Устанавливаем verified = true для всех существующих пользователей с завершенной регистрацией
UPDATE users SET verified = true WHERE registration_state = 'completed';

-- Создаем индекс для быстрого поиска по verified
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);
