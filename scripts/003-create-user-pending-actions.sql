-- Создание таблицы для отслеживания ожидаемых действий пользователя
CREATE TABLE IF NOT EXISTS user_pending_actions (
    user_id BIGINT PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL, -- Например, 'awaiting_rejection_comment'
    related_message_id INTEGER,       -- ID сообщения в campaign_messages, к которому относится действие
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_user_pending_actions_user_id ON user_pending_actions(user_id);
