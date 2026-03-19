-- Add tenant_score to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_score" INT DEFAULT 100;

-- Add meeting tracking fields to invoice
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "meeting_status" VARCHAR(50) DEFAULT 'none';
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "meeting_date" DATE;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "meeting_time" TIME;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "meeting_note" TEXT;
