-- Phase 13, Plan 02: Extend Shopping List Items Table (INFRA-06)
-- Adds provider aisle data: aisle TEXT, amount NUMERIC, unit TEXT.
-- All nullable: AI-generated items will not have Spoonacular aisle data.
-- aisle: free-text from Spoonacular (e.g., "Produce", "Baking", "Dairy")
-- amount: NUMERIC exact type (supports 0.5, 1.25 fractional quantities; not FLOAT)
-- unit: free-text string (e.g., "cup", "oz", "tbsp")

ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS aisle TEXT;
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.shopping_list_items ADD COLUMN IF NOT EXISTS unit TEXT;
