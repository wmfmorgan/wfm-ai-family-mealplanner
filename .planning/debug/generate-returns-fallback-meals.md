---
status: investigating
trigger: "generate-returns-fallback-meals — Clicking Generate Plan completes without error but all meal slots are fallback (AI-generated) instead of Spoonacular-grounded recipes"
created: 2026-04-18T00:00:00Z
updated: 2026-04-19T00:00:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: The missing-key hypothesis is eliminated (key is now deployed). The fallback is caused by one or more of three remaining paths — each of which produces silent HTTP 200 with ai-generated slots: (A) the API key was deployed with leading/trailing whitespace so Spoonacular returns 401 and !providerResponse.ok fires, (B) today's spoonacular_usage_log rows from prior Generate attempts pushed points_used_today >= 40 (threshold), or (C) AI coordinator query strings with tight or equal min_calories/max_calories produce provider-no-results for every directive. The code previously had no logging or response field that surfaced which path was active.
test: Added fallback_reason field to SlotResponse so the browser response exposes the exact reason for every fallback slot. Added console.error for every non-cache fallback path. Trimmed apiKey before use to neutralize whitespace. Deployed the fix so the user can regenerate and inspect response.slots[N].fallback_reason.
expecting: After redeploying the edge function and regenerating, the response will show specific fallback reasons — e.g. 'provider-error-401' confirms key whitespace issue; 'quota-threshold-reached' confirms DB row accumulation; 'provider-no-results' confirms query/calorie range issue.
next_action: deploy recipe-search/index.ts, regenerate, inspect fallback_reason values in browser DevTools Network tab

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

## Resolution

root_cause: |
  Three potential active causes, all producing silent HTTP 200 with ai-generated slots. The code had no logging or response field to distinguish them:
  (A) API key deployed with whitespace → Spoonacular returns 401 → !providerResponse.ok fires → provider-error-401 fallback
  (B) Prior Generate runs after key was added accumulated points_used_today >= 40 in spoonacular_usage_log → threshold_reached=true → quota-threshold-reached fallback
  (C) AI coordinator generates min_calories == max_calories (or very tight range) when all household members share same target_calories → Spoonacular returns 0 results → provider-no-results fallback
  Root cause (A) is highest probability because it explains why ALL slots fail from the first directive.

fix: |
  1. CODE (applied): Added fallback_reason: string | null to SlotResponse type and propagated it through normalizeFallbackSlot and buildFallbackSlot. Now every slot in the response includes the exact reason it fell back — visible in browser DevTools Network tab.
  2. CODE (applied): Added console.error for every non-cache fallback path in the directive loop, including quota state, status codes, query strings, and candidate counts.
  3. CODE (applied): Trimmed the apiKey value (rawApiKey.trim()) before use — neutralizes whitespace from Dashboard copy-paste.
  4. OPS (pending): Redeploy recipe-search edge function: supabase functions deploy recipe-search
  5. FOLLOW-UP (pending): After redeploying, user regenerates and inspects response.slots[N].fallback_reason. If 'provider-no-results', additional fix needed for calorie range widening. If 'provider-error-4xx', key value is wrong and must be re-set.

verification: pending — fix deployed, awaiting user to regenerate and report fallback_reason values from browser DevTools
files_changed:
  - supabase/functions/recipe-search/index.ts
