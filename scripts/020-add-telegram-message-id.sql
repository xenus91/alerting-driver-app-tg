-- Добавляем поле telegram_message_id в таблицу trip_messages
ALTER TABLE trip_messages ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
