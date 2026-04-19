---
status: awaiting_human_verify
trigger: "generate-returns-fallback-meals — Clicking Generate Plan completes without error but all meal slots are fallback (AI-generated) instead of Spoonacular-grounded recipes"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T22:30:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED — TWO root causes. (1) Zero-width calorie range (calorie-widening fix already in code, NOT YET deployed — user confirmed still getting fallback). (2) NEWLY CONFIRMED: The system prompt in buildPrompts explicitly grants the AI permission to use phrases like "leftovers", "family style", "double batch" when leftover_strategy is true. leftover_strategy defaults to true (MealPlanner.tsx line 23 useState(true)). AI coordinator generates verbose queries like "chicken pasta dinner family style for leftovers" — these return 0 results from Spoonacular regardless of calorie range. The checkpoint evidence (recipe name "chicken pasta dinner family style for leftovers fallback") confirms this is actively firing.
test: Fix system prompt to enforce short, searchable queries unconditionally. The "leftover strategy" concept should control which recipe types are chosen (e.g. same query for two slots), never the query string verbosity. Apply this alongside the calorie-widening and number=5 fixes.
expecting: After deploying select-meals with corrected system prompt + calorie-widening, AI generates queries like "chicken pasta" or "pasta bake" (not "chicken pasta dinner family style for leftovers"), Spoonacular returns results, slots show source_provider=spoonacular.
next_action: Fix system prompt in select-meals/index.ts, deploy both functions, regenerate

## Symptoms

expected: Clicking Generate triggers select-meals then recipe-search; meal slots show Spoonacular recipe names, images, and aisle-level ingredients with source_provider="spoonacular"
actual: Generation completes without error but all slots are fallback meals — no Spoonacular images, no aisle metadata, fallback ingredients
errors: No visible errors reported by user. Prior issue (select-meals 500) was fixed by raising coordinator max_tokens to 4096.
reproduction: Click Generate in MealPlanner with a valid household
started: Ongoing — the select-meals 500 was fixed (plan 14-06) but grounded recipes still not appearing

## Eliminated

- hypothesis: quota threshold already reached → threshold_reached fallback path
  evidence: UAT test 2 (quota threshold / fallback) passed — quota display works. A household with zero prior usage has points_used_today=0, threshold=ceil(50*0.8)=40, so threshold_reached=false. Not firing (for first-ever session).
  timestamp: 2026-04-18T00:00:00Z

- hypothesis: Cache hit returning stale/fallback data
  evidence: loadCachedRecipe with no prior cache returns null. Even with a stale cache, normalizeProviderSlot produces source_provider='spoonacular' slots, not fallback. Cache cannot produce fallback slots.
  timestamp: 2026-04-18T00:00:00Z

- hypothesis: select-meals returning directives incorrectly
  evidence: UAT test 3 (Two-Step Generation Flow) passed — two sequential edge function calls confirmed. recipe-search receives valid directives.
  timestamp: 2026-04-18T00:00:00Z

- hypothesis: fetchComplexSearch sends apiKey in wrong HTTP header format
  evidence: Spoonacular supports BOTH 'x-api-key' HTTP header AND 'apiKey' query parameter. Header format in spoonacular.ts line 111 is valid. Auth format is not the bug.
  timestamp: 2026-04-18T00:00:00Z

- hypothesis: DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD module-level const fires threshold too early
  evidence: DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD = Number(Deno.env.get('SPOONACULAR_FALLBACK_THRESHOLD') ?? '0.8') = 0.8 at module load. With dailyLimit=50 and 0 usage, thresholdPoints=40, threshold_reached=(0>=40)=false. Threshold is not firing.
  timestamp: 2026-04-18T00:00:00Z

- hypothesis: extendedIngredients not returned by complexSearch
  evidence: Spoonacular docs confirm: complexSearch with addRecipeInformation=true + fillIngredients=true DOES return extendedIngredients (including aisle field) on each result. The fetch params are correct. This is not the issue.
  timestamp: 2026-04-18T00:00:00Z

- hypothesis: SPOONACULAR_API_KEY not deployed as a Supabase secret
  evidence: User confirmed "i added the key but still only get fallback meals" — key was deployed via Supabase Dashboard. The !apiKey guard no longer fires. The fallback is from a different path.
  timestamp: 2026-04-19T00:00:00Z

- hypothesis: Spoonacular type parameter invalid for lunch/dinner
  evidence: Direct curl tests confirmed both 'lunch' and 'dinner' return results from Spoonacular complexSearch. Not the issue.
  timestamp: 2026-04-19T00:00:00Z

## Evidence

- timestamp: 2026-04-18T00:00:00Z
  checked: supabase/functions/.env
  found: SPOONACULAR_API_KEY=4e46a88ede9a4ed295b673daa88fdb29 — key is present locally
  implication: This file is only used by `supabase functions serve` during local development. It is NOT deployed to the production edge runtime.

- timestamp: 2026-04-18T00:00:00Z
  checked: entire codebase and planning docs for `supabase secrets set` commands
  found: STACK.md line 255: "supabase secrets set SPOONACULAR_API_KEY=your_key_here" — listed as required installation step. No evidence this command was ever run. 03-RESEARCH.md confirms secrets must be explicitly deployed.
  implication: SPOONACULAR_API_KEY was never deployed as a Supabase secret. Deno.env.get('SPOONACULAR_API_KEY') returns undefined in the deployed function.

- timestamp: 2026-04-18T00:00:00Z
  checked: recipe-search/index.ts lines 451-480 — apiKey check and fallback
  found: const apiKey = Deno.env.get('SPOONACULAR_API_KEY'); ... if (!apiKey) { slots.push(await buildFallbackSlot(..., 'missing-spoonacular-api-key')); continue; }
  implication: With apiKey=undefined, !apiKey=true for EVERY directive. buildFallbackSlot fires on every iteration. Result is HTTP 200 with all AI-generated slots and no error output to the browser.

- timestamp: 2026-04-18T00:00:00Z
  checked: symptom match
  found: "no visible errors" + "all slots are fallback" + "completes without error" — all match the missing-key path exactly. The 200-status response with AI fallback content is indistinguishable from success at the HTTP level.
  implication: This is a silent configuration failure. The code is correct — the deployment step was never completed.

- timestamp: 2026-04-19T00:00:00Z
  checked: checkpoint response — user added key but still gets fallback meals
  found: SPOONACULAR_API_KEY now deployed. !apiKey guard eliminated. Fallback coming from a different code path.
  implication: Need to identify which of three remaining paths is active: provider-error-4xx (bad key value), quota-threshold-reached (prior DB rows), or provider-no-results (restrictive queries).

- timestamp: 2026-04-19T00:00:00Z
  checked: direct curl test of Spoonacular API with key 4e46a88ede9a4ed295b673daa88fdb29
  found: HTTP 200 with results; x-api-quota-used=7.66, x-api-quota-request=1.22; extendedIngredients present; breakfast/lunch/dinner types all return results
  implication: The key is valid and functional. If the deployed key value exactly matches (no whitespace), fetchComplexSearch should succeed. If it has whitespace, Spoonacular returns 401.

- timestamp: 2026-04-19T00:00:00Z
  checked: recipe-search/index.ts fallback paths — logging and response fields
  found: No fallback_reason was present in SlotResponse or HTTP response body. All fallback paths silently produced ai-generated slots with no observable difference between reasons. No console.error on non-missing-key fallback paths.
  implication: This is the core diagnostic gap. Without fallback_reason in the response, neither the user nor DevTools can distinguish provider-error-401 from provider-no-results from quota-threshold. Fix: add fallback_reason to SlotResponse and console.error for all fallback paths.

- timestamp: 2026-04-19T00:00:00Z
  checked: calorie range passed to Spoonacular — minCalories/maxCalories params
  found: Direct curl test with query="grilled chicken salad" type=lunch minCalories=400 maxCalories=400 (same value) → 0 results. When min_calories == max_calories (single target_calories member), Spoonacular returns empty.
  implication: If household members all have the same target_calories, the AI coordinator generates directives with min_calories == max_calories, causing provider-no-results for every directive.

- timestamp: 2026-04-18T21:00:00Z
  checked: checkpoint response — fallback_reason confirmed as "provider-no-results"; quota 17.66 pts, threshold not reached
  found: Spoonacular IS being called. Key is valid. Quota not exceeded. 0 results returned for every directive. Recipe name "chicken pasta dinner family style for leftovers fallback" shows AI fallback, not Spoonacular result.
  implication: Zero-width calorie range is the confirmed root cause. No other path is active.

- timestamp: 2026-04-18T21:00:00Z
  checked: collectMemberContext in select-meals/index.ts lines 111-151
  found: Single member with target_calories=N produces minCalories=N, maxCalories=N (both set from same value). This zero-width range is passed to AI coordinator as household_constraints.calorie_range. AI then generates directives with min_calories=N, max_calories=N. fetchComplexSearch sends minCalories=N&maxCalories=N to Spoonacular.
  implication: Every directive produces provider-no-results. Fix: widen to ±20% when min===max at both the collectMemberContext level (so AI gets realistic range) and fetchComplexSearch level (safety net).

- timestamp: 2026-04-18T21:00:00Z
  checked: fetchComplexSearch number parameter in spoonacular.ts line 83
  found: number=2 — only 2 candidates requested. With allergen filtering via selectCompliantCandidate, if both candidates contain allergens, fallback fires even when Spoonacular has valid results.
  implication: Increased to number=5 for more candidate headroom.

- timestamp: 2026-04-18T21:00:00Z
  checked: normalizeDirective in select-meals/index.ts lines 177-179
  found: Hard rejection (return null) when min_calories or max_calories is not a number. SearchDirective type declares these as number | null. If household has no calorie targets at all, AI may produce null and the directive is silently dropped, causing "did not produce directives for every enabled matrix cell" error.
  implication: Relaxed to accept null via parseCalories helper — lets calorie-free households generate plans without crashing.

- timestamp: 2026-04-18T22:00:00Z
  checked: checkpoint response — recipe name "chicken pasta dinner family style for leftovers fallback" after calorie-widening fix deployed (or not yet deployed)
  found: The recipe name is built from `${directive.query} fallback` in normalizeFallbackSlot line 227. This means the AI coordinator sent query="chicken pasta dinner family style for leftovers". Spoonacular returned 0 results for this verbose query, triggering provider-no-results fallback.
  implication: The calorie-widening fix alone is insufficient. Even with a valid calorie range, Spoonacular returns 0 for a 7-word leftover-phrase query. The system prompt's "unless leftover strategy is explicitly enabled" carve-out is actively causing this.

- timestamp: 2026-04-18T22:00:00Z
  checked: MealPlanner.tsx line 23 — leftoverStrategy initial state
  found: const [leftoverStrategy, setLeftoverStrategy] = useState<boolean>(true) — defaults to true on every page load. User has not toggled it off. select-meals receives leftover_strategy=true for every generation.
  implication: leftoverStrategy=true is the default runtime state. The AI coordinator always has permission to use verbose leftover phrases in query strings.

- timestamp: 2026-04-18T22:00:00Z
  checked: select-meals/index.ts buildPrompts systemPrompt — the carve-out sentence
  found: "Do not use query phrases like 'leftovers', 'meal prep', 'batch cook', 'cook once eat twice', 'family style', or 'double batch' unless leftover strategy is explicitly enabled." Combined with leftover_strategy=true default, this unconditionally grants AI permission to use all banned phrases.
  implication: Fix must remove the "unless" carve-out. Leftover strategy should only affect WHICH slots share a query (two slots with same short query = cook-once plan), not the verbosity of the query string itself.

## Resolution

root_cause: |
  TWO confirmed root causes for provider-no-results on every directive:
  1. Zero-width calorie range: collectMemberContext produces min_calories === max_calories for single-member households. Spoonacular returns 0 results for a zero-width range. Fix (calorie-widening ±20%) is already in code but NOT YET DEPLOYED.
  2. Verbose AI-generated queries from leftover strategy: The system prompt in buildPrompts explicitly allows phrases like "leftovers", "family style", "double batch" when leftover_strategy is true. leftover_strategy defaults to true (MealPlanner.tsx line 23). AI generates queries like "chicken pasta dinner family style for leftovers" which Spoonacular cannot match regardless of calorie range. This second cause is actively firing and is the more immediate blocker — even after deploying the calorie-widening fix, queries like this would still return 0 results.

fix: |
  1. select-meals/index.ts — buildPrompts systemPrompt: enforce short, provider-searchable query strings unconditionally. Remove the "unless leftover strategy is explicitly enabled" carve-out that permits verbose query phrases. Leftover strategy should express itself via repeated queries across slots (same short query for two slots = plan to cook once and eat twice), never via verbose query strings.
  2. select-meals/index.ts — collectMemberContext: widen calorie range ±20% when min===max (already in code, not yet deployed).
  3. spoonacular.ts — fetchComplexSearch: same ±20% calorie widening safety net (already in code, not yet deployed).
  4. spoonacular.ts — fetchComplexSearch: number=5 (already in code, not yet deployed).
  5. select-meals/index.ts — normalizeDirective: parseCalories helper accepts null (already in code, not yet deployed).

verification: pending — all code fixes applied; awaiting deploy and user verification
files_changed:
  - supabase/functions/_shared/spoonacular.ts
  - supabase/functions/select-meals/index.ts
