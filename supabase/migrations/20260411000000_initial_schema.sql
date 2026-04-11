-- Initial schema for WFM AI Family Meal Planner
-- Created: 2026-04-11

-- Households Table
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT households_owner_id_key UNIQUE (owner_id)
);

-- Household Members Table (Profiles)
CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nutrition_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Policies for Households
-- Users can see/edit only their own household
CREATE POLICY "Users can manage their own household" 
ON public.households
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Policies for Household Members
-- Users can see/edit members of their own household
CREATE POLICY "Users can manage members of their own household"
ON public.household_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.households
    WHERE households.id = household_members.household_id
    AND households.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households
    WHERE households.id = household_members.household_id
    AND households.owner_id = auth.uid()
  )
);
