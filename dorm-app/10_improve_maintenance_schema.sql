-- Add new columns to maintenance_request
ALTER TABLE maintenance_request 
ADD COLUMN IF NOT EXISTS issue_type TEXT,
ADD COLUMN IF NOT EXISTS equipment_id BIGINT REFERENCES equipment(id),
ADD COLUMN IF NOT EXISTS equipment_name TEXT;

-- Optional: Migrate existing data (crude string parsing)
UPDATE maintenance_request
SET 
  issue_type = substring(issue_description from '\[Type: (.*?)\]'),
  equipment_name = substring(issue_description from '\[Equipment: (.*?)\]'),
  issue_description = regexp_replace(issue_description, '\[Type: .*?\]\s*|\[Equipment: .*?\]\s*', '', 'g')
WHERE issue_description LIKE '[Type: %';
