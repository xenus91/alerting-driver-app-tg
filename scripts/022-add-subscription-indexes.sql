-- Добавляем индексы для оптимизации запросов подписок
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_active ON trip_subscriptions(is_active, trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_notification ON trip_subscriptions(last_notification_at, interval_minutes) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_user ON trip_subscriptions(user_id) WHERE is_active = true;

-- Добавляем составной индекс для быстрого поиска подписок готовых к уведомлению
CREATE INDEX IF NOT EXISTS idx_trip_subscriptions_due ON trip_subscriptions(is_active, last_notification_at, interval_minutes);
