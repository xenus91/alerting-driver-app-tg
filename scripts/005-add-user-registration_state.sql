-- Добавляем поле для отслеживания состояния регистрации пользователя
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS registration_state VARCHAR(50) DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS temp_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS temp_last_name VARCHAR(100);

-- Создаем индекс для состояния регистрации
CREATE INDEX IF NOT EXISTS idx_users_registration_state ON users(registration_state);
