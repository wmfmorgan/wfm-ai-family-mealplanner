-- Phase 13, Plan 03: Bulk Save RPC (INFRA-05)
-- Atomically inserts a full week's meal plan, recipes, slots, and shopping items.
-- Single transaction: any failure rolls back everything (no partial writes).
-- D-10: accepts single JSONB payload
-- D-11: returns meal_plan_id UUID only
-- D-12: duplicate week raises exception via UNIQUE constraint (meal_plans_unique_week)

CREATE OR REPLACE FUNCTION public.save_meal_plan_bulk(payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id  UUID;
  v_meal_plan_id  UUID;
  v_recipe_id     UUID;
  slot            JSONB;
BEGIN
  v_household_id := (payload->>'household_id')::UUID;

  -- Pitfall 3: Verify caller owns the household before any DML
  IF NOT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = v_household_id
    AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Household not found or access denied';
  END IF;

  -- D-12: INSERT (not upsert) — UNIQUE constraint meal_plans_unique_week raises exception on duplicate week
  INSERT INTO public.meal_plans (household_id, week_start_date, status)
  VALUES (
    v_household_id,
    (payload->>'week_start_date')::DATE,
    'active'
  )
  RETURNING id INTO v_meal_plan_id;

  -- Iterate slots and insert recipes, meal_plan_slots, shopping_list_items per slot
  FOR slot IN SELECT * FROM jsonb_array_elements(payload->'slots')
  LOOP
    -- Insert recipe row
    INSERT INTO public.recipes (
      household_id,
      name,
      ingredients,
      instructions,
      nutrition,
      prep_time_min,
      cook_time_min,
      servings,
      source_provider,
      source_id,
      image_url
    )
    VALUES (
      v_household_id,
      slot->'recipe'->>'name',
      COALESCE(slot->'recipe'->'ingredients', '[]'::jsonb),
      COALESCE(slot->'recipe'->'instructions', '[]'::jsonb),
      COALESCE(slot->'recipe'->'nutrition', '{}'::jsonb),
      COALESCE((slot->'recipe'->>'prep_time_min')::INTEGER, 0),
      COALESCE((slot->'recipe'->>'cook_time_min')::INTEGER, 0),
      COALESCE((slot->'recipe'->>'servings')::INTEGER, 1),
      slot->'recipe'->>'source_provider',
      slot->'recipe'->>'source_id',
      slot->'recipe'->>'image_url'
    )
    RETURNING id INTO v_recipe_id;

    -- Insert meal plan slot
    INSERT INTO public.meal_plan_slots (meal_plan_id, day_of_week, meal_type, recipe_id)
    VALUES (
      v_meal_plan_id,
      (slot->>'day')::INTEGER,
      slot->>'meal_type',
      v_recipe_id
    );

    -- Insert shopping items for this slot
    INSERT INTO public.shopping_list_items (
      meal_plan_id,
      original_string,
      category,
      aisle,
      amount,
      unit
    )
    SELECT
      v_meal_plan_id,
      item->>'original_string',
      COALESCE(item->>'category', 'Other'),
      item->>'aisle',
      (item->>'amount')::NUMERIC,
      item->>'unit'
    FROM jsonb_array_elements(COALESCE(slot->'shopping_items', '[]'::jsonb)) AS item
    ON CONFLICT (meal_plan_id, original_string) DO NOTHING;
  END LOOP;

  -- D-11: return only the meal_plan_id
  RETURN v_meal_plan_id;
END;
$$;

-- Grant execute to authenticated users (RPC is callable via Supabase client)
GRANT EXECUTE ON FUNCTION public.save_meal_plan_bulk(JSONB) TO authenticated;
