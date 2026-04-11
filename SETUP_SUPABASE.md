# Supabase Setup: SQL Instructions

To resolve login issues and ensure your household data is correctly initialized, follow these steps to apply the necessary database schema and triggers.

### **How to Apply the SQL**
1. Log in to your **Supabase Dashboard**.
2. Select your project.
3. Click on **SQL Editor** in the left-hand sidebar (the `>_` icon).
4. Click **+ New Query**.
5. Paste the entire block of SQL below into the editor.
6. Click **Run** (or press `Cmd + Enter`).

---

```sql
-- 1. Create Households and Members Tables
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT households_owner_id_key UNIQUE (owner_id)
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nutrition_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_owner BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- 3. Define Security Policies
DROP POLICY IF EXISTS "Users can manage their own household" ON public.households;
CREATE POLICY "Users can manage their own household" 
ON public.households
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can manage their own household members" ON public.household_members;
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

-- 4. Nutrition Profile Validation Logic
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

ALTER TABLE public.household_members
DROP CONSTRAINT IF EXISTS check_nutrition_profile_valid,
ADD CONSTRAINT check_nutrition_profile_valid CHECK (validate_nutrition_profile(nutrition_profile));

-- 5. Auto-Initialization Trigger (The "Me" Member)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  INSERT INTO public.households (owner_id)
  VALUES (new.id)
  ON CONFLICT (owner_id) DO UPDATE SET owner_id = EXCLUDED.owner_id
  RETURNING id INTO new_household_id;

  IF new_household_id IS NOT NULL THEN
    INSERT INTO public.household_members (household_id, name, is_owner, nutrition_profile)
    VALUES (
      new_household_id, 
      'Me', 
      true, 
      jsonb_build_object(
        'target_calories', 2000,
        'macro_targets', jsonb_build_object('protein_pct', 30, 'carbs_pct', 40, 'fat_pct', 30),
        'allergies', '[]'::jsonb,
        'avoidances', '[]'::jsonb,
        'appliances', jsonb_build_array('oven', 'stove'),
        'cooking_skill', 'intermediate',
        'is_child', false
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```
