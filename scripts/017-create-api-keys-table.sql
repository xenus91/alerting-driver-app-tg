-- Создаем таблицу для API ключей
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permissions TEXT[] DEFAULT ARRAY['read_users'], -- Массив разрешений
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP -- NULL означает без срока действия
);

-- Создаем индекс для быстрого поиска по ключу
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Добавляем комментарии
COMMENT ON TABLE api_keys IS 'API ключи для внешнего доступа';
COMMENT ON COLUMN api_keys.permissions IS 'Массив разрешений: read_users, write_users, read_trips, etc.';
