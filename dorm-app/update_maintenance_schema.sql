-- Add columns for technician assignment and reporting
ALTER TABLE maintenance_request
ADD COLUMN IF NOT EXISTS technician_id BIGINT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS technician_comment TEXT,
ADD COLUMN IF NOT EXISTS technician_photo TEXT;

-- Optional: Index on technician_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_technician_id ON maintenance_request(technician_id);
