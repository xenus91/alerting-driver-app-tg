-- Добавляем поле для хранения JSON данных в pending actions
ALTER TABLE user_pending_actions 
ADD COLUMN action_data TEXT;

-- Добавляем комментарий для ясности
COMMENT ON COLUMN user_pending_actions.action_data IS 'JSON data for complex pending actions like route building';
