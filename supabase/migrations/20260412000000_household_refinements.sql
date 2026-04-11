-- Household and Profile Refinements
-- Created: 2026-04-12

-- 1. Add columns for ownership and activity status to household_members
ALTER TABLE public.household_members 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Create the nutrition profile validation function
-- This ensures the JSONB structure matches our AI requirements
CREATE OR REPLACE FUNCTION public.validate_nutrition_profile(profile JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    jsonb_typeof(profile->'target_calories') = 'number' AND
    jsonb_typeof(profile->'macro_targets') = 'object' AND
    jsonb_typeof(profile->'macro_targets'->'protein_pct') = 'number' AND
    jsonb_typeof(profile->'macro_targets'->'carbs_pct') = 'number' AND
    jsonb_typeof(profile->'macro_targets'->'fat_pct') = 'number' AND
    jsonb_typeof(profile->'allergies') = 'array' AND
    jsonb_typeof(profile->'avoidances') = 'array' AND
    jsonb_typeof(profile->'appliances') = 'array' AND
    jsonb_typeof(profile->'cooking_skill') = 'string' AND
    jsonb_typeof(profile->'is_child') = 'boolean'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Add CHECK constraint for nutrition_profile validation
ALTER TABLE public.household_members
DROP CONSTRAINT IF EXISTS check_nutrition_profile_valid,
ADD CONSTRAINT check_nutrition_profile_valid CHECK (validate_nutrition_profile(nutrition_profile));

-- 4. Create function to handle new user signup
-- Automatically creates a household and an initial 'Me' member
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create the household or get the existing one
  INSERT INTO public.households (owner_id)
  VALUES (new.id)
  ON CONFLICT (owner_id) DO UPDATE SET owner_id = EXCLUDED.owner_id -- Dummy update to ensure we get a row back
  RETURNING id INTO new_household_id;

  -- If a household was created or found, create the initial 'Me' member
  IF new_household_id IS NOT NULL THEN
    INSERT INTO public.household_members (
      household_id, 
      name, 
      is_owner, 
      nutrition_profile
    )
    VALUES (
      new_household_id, 
      'Me', 
      true, 
      jsonb_build_object(
        'target_calories', 2000,
        'macro_targets', jsonb_build_object(
          'protein_pct', 30,
          'carbs_pct', 40,
          'fat_pct', 30
        ),
        'allergies', '[]'::jsonb,
        'avoidances', '[]'::jsonb,
        'appliances', jsonb_build_array('oven', 'stove'),
        'cooking_skill', 'intermediate',
        'is_child', false
      )
    )
    ON CONFLICT DO NOTHING; -- Avoid duplicates if trigger runs multiple times
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Update RLS policies to reflect ownership
-- Drop old policy for household_members
DROP POLICY IF EXISTS "Users can manage members of their own household" ON public.household_members;

-- New policy: Users can see all members in their household, but only owners can edit?
-- Let's stick with the current requirement: "Users can manage their own household" 
-- which for now means the owner (the auth user) has full access to their household's members.
CREATE POLICY "Users can manage their own household members"
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
