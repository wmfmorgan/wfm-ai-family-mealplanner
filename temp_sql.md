-- Phase 5, Plan 01: Shopping List Table
-- Created: 2026-04-15

-- Shopping List Items Table
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  original_string TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shopping_list_items_unique_entry UNIQUE (meal_plan_id, original_string)
);

-- Enable RLS
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Policies for Shopping List Items
CREATE POLICY "Users can manage shopping items for their own meal plans"
ON public.shopping_list_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meal_plans
    JOIN public.households ON households.id = meal_plans.household_id
    WHERE meal_plans.id = shopping_list_items.meal_plan_id
    AND households.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meal_plans
    JOIN public.households ON households.id = meal_plans.household_id
    WHERE meal_plans.id = shopping_list_items.meal_plan_id
    AND households.owner_id = auth.uid()
  )
);
