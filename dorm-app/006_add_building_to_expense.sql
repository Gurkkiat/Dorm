-- Migration: 006_add_building_to_expense
-- Purpose: Adds the building_id column to the existing expenses table to allow managers to record utility bills per building.

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS building_id bigint REFERENCES public.building(id) ON DELETE CASCADE;

-- Optional: If promotion_id is currently NOT NULL and you don't always have a promotion for utility bills,
-- you might need to make it nullable so inserting bills doesn't fail.
ALTER TABLE public.expenses 
ALTER COLUMN promotion_id DROP NOT NULL;
