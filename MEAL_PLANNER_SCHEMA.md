# Meal Planner Core - Database Schema

Apply this SQL in your Supabase SQL Editor to create the tables required for Phase 4.

```sql
-- 1. Create Recipes Table
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  nutrition JSONB NOT NULL DEFAULT '{}'::jsonb,
  prep_time_min INTEGER DEFAULT 0,
  cook_time_min INTEGER DEFAULT 0,
  servings INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Meal Plans Table
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, week_start_date)
);

-- 3. Create Meal Plan Slots Table
CREATE TABLE IF NOT EXISTS public.meal_plan_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type TEXT NOT NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  manual_entry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_slots ENABLE ROW LEVEL SECURITY;

-- 5. Define Security Policies

-- Recipes
DROP POLICY IF EXISTS "Users can manage their own recipes" ON public.recipes;
CREATE POLICY "Users can manage their own recipes" 
ON public.recipes 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.households WHERE households.id = recipes.household_id AND households.owner_id = auth.uid())
);

-- Meal Plans
DROP POLICY IF EXISTS "Users can manage their own meal plans" ON public.meal_plans;
CREATE POLICY "Users can manage their own meal plans" 
ON public.meal_plans 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.households WHERE households.id = meal_plans.household_id AND households.owner_id = auth.uid())
);

-- Meal Plan Slots
DROP POLICY IF EXISTS "Users can manage their own meal plan slots" ON public.meal_plan_slots;
CREATE POLICY "Users can manage their own meal plan slots" 
ON public.meal_plan_slots 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.meal_plans 
    JOIN public.households ON households.id = meal_plans.household_id 
    WHERE meal_plan_slots.meal_plan_id = meal_plans.id 
    AND households.owner_id = auth.uid()
  )
);
```
