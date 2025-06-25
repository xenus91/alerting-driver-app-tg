-- Добавляем поле verified �� таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT true;

-- Устанавливаем verified = true для всех существующих пользователей с завершенной регистрацией
UPDATE users SET verified = true WHERE registration_state = 'completed';

-- Обновляем существующих пользователей как верифицированных
UPDATE users SET verified = true WHERE verified IS NULL;

-- Создаем индекс для быстрого поиска по verified
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);

-- Создаем индекс для поиска по телефону и верификации
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users(phone, verified);
