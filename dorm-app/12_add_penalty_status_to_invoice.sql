-- 12_add_penalty_status_to_invoice.sql
ALTER TABLE invoice ADD COLUMN penalty_status TEXT DEFAULT 'none';
