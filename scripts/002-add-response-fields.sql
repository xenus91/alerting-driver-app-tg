-- Добавляем поля для ответов пользователей в таблицу campaign_messages
ALTER TABLE campaign_messages 
ADD COLUMN IF NOT EXISTS response_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS response_comment TEXT,
ADD COLUMN IF NOT EXISTS response_at TIMESTAMP;

-- Создаем индекс для быстрого поиска по статусу ответа
CREATE INDEX IF NOT EXISTS idx_campaign_messages_response_status ON campaign_messages(response_status);

-- Обно��ляем существующие записи
UPDATE campaign_messages 
SET response_status = 'pending' 
WHERE response_status IS NULL;
