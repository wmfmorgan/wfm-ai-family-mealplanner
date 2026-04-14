-- Add missing columns to recipes table
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS description TEXT;
