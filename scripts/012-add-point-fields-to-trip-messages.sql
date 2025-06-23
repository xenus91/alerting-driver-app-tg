-- Add point-related fields to trip_messages table
ALTER TABLE trip_messages 
ADD COLUMN point_id VARCHAR(10),
ADD COLUMN point_type VARCHAR(1) CHECK (point_type IN ('P', 'D')),
ADD COLUMN point_num INTEGER;

-- Add index for better performance
CREATE INDEX idx_trip_messages_point_id ON trip_messages(point_id);
CREATE INDEX idx_trip_messages_trip_identifier ON trip_messages(trip_identifier);
