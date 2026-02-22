-- Add water config type to building table
ALTER TABLE building ADD COLUMN IF NOT EXISTS water_config_type VARCHAR DEFAULT 'unit';
-- Add fixed price to building table
ALTER TABLE building ADD COLUMN IF NOT EXISTS water_fixed_price NUMERIC DEFAULT NULL;
