-- Add status field to trips table if it doesn't exist
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Update existing trips to have 'active' status
UPDATE trips SET status = 'active' WHERE status IS NULL;
