-- Phase 4, Plan 01: Meal Planner Core Schema
-- Created: 2026-04-13

-- Recipes Table
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  nutrition JSONB NOT NULL DEFAULT '{}'::jsonb,
  prep_time_min INTEGER NOT NULL DEFAULT 0,
  cook_time_min INTEGER NOT NULL DEFAULT 0,
  servings INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meal Plans Table
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meal_plans_unique_week UNIQUE (household_id, week_start_date)
);

-- Meal Plan Slots Table
CREATE TABLE IF NOT EXISTS public.meal_plan_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  manual_entry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_slots ENABLE ROW LEVEL SECURITY;

-- Policies for Recipes
CREATE POLICY "Users can manage recipes for their own household"
ON public.recipes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.households
    WHERE households.id = recipes.household_id
    AND households.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households
    WHERE households.id = recipes.household_id
    AND households.owner_id = auth.uid()
  )
);

-- Policies for Meal Plans
CREATE POLICY "Users can manage meal plans for their own household"
ON public.meal_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.households
    WHERE households.id = meal_plans.household_id
    AND households.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households
    WHERE households.id = meal_plans.household_id
    AND households.owner_id = auth.uid()
  )
);

-- Policies for Meal Plan Slots
CREATE POLICY "Users can manage slots for their own meal plans"
ON public.meal_plan_slots
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meal_plans
    JOIN public.households ON households.id = meal_plans.household_id
    WHERE meal_plans.id = meal_plan_slots.meal_plan_id
    AND households.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meal_plans
    JOIN public.households ON households.id = meal_plans.household_id
    WHERE meal_plans.id = meal_plan_slots.meal_plan_id
    AND households.owner_id = auth.uid()
  )
);
