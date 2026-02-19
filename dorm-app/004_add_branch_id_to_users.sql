-- Add branch_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES branch(id);

-- Optional: Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
