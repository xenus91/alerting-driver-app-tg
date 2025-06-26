-- Создаем таблицу для подписок на уведомления о прогрессе рассылок
CREATE TABLE IF NOT EXISTS trip_subscriptions (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_telegram_id BIGINT NOT NULL,
  interval_minutes INTEGER NOT NULL CHECK (interval_minutes > 0 AND interval_minutes % 15 = 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_notification_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(trip_id, user_telegram_id)
);

-- Индекс для быстрого поиска активных подписок
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_active ON trip_subscriptions(is_active, last_notification_at) WHERE is_active = true;

-- Индекс для поиска по рассылке
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_trip_id ON trip_subscriptions(trip_id);
