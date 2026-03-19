-- Migration: 007_add_receipt_to_expenses
-- Purpose: Adds the receipt_url column to the expenses table to allow image uploads for utility bills.

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS receipt_url text;
