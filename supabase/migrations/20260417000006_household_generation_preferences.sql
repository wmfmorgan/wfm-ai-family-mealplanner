ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS generation_preferences JSONB NOT NULL DEFAULT '{
  "selected_days": [0,1,2,3,4,5,6],
  "selected_meals": ["breakfast","lunch","dinner"],
  "matrix": {
    "0": ["breakfast","lunch","dinner"],
    "1": ["breakfast","lunch","dinner"],
    "2": ["breakfast","lunch","dinner"],
    "3": ["breakfast","lunch","dinner"],
    "4": ["breakfast","lunch","dinner"],
    "5": ["breakfast","lunch","dinner"],
    "6": ["breakfast","lunch","dinner"]
  }
}'::jsonb;

ALTER TABLE public.households
DROP CONSTRAINT IF EXISTS households_generation_preferences_shape_check;

ALTER TABLE public.households
ADD CONSTRAINT households_generation_preferences_shape_check
CHECK (
  generation_preferences ? 'selected_days'
  AND generation_preferences ? 'selected_meals'
  AND generation_preferences ? 'matrix'
);
