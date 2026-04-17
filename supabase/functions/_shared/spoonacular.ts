export const DEFAULT_SPOONACULAR_DAILY_LIMIT = Number(
  Deno.env.get('SPOONACULAR_DAILY_LIMIT') ?? '150',
)

export const DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD = Number(
  Deno.env.get('SPOONACULAR_FALLBACK_THRESHOLD') ?? '0.8',
)

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"

export type SearchDirective = {
  day: number
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  query: string
  cuisine: string | null
  diet: string | null
  min_calories: number | null
  max_calories: number | null
  intolerances: string[]
  exclude_ingredients: string[]
  fallback_reason: string | null
}

export type SpoonacularIngredient = {
  original?: string | null
  aisle?: string | null
  amount?: number | null
  unit?: string | null
  name?: string | null
  nameClean?: string | null
}

export type SpoonacularRecipeResult = {
  id: number
  title: string
  summary?: string | null
  readyInMinutes?: number | null
  cookingMinutes?: number | null
  preparationMinutes?: number | null
  servings?: number | null
  image?: string | null
  extendedIngredients?: SpoonacularIngredient[] | null
  analyzedInstructions?: unknown[] | null
  nutrition?: Record<string, unknown> | null
}

export function buildDirectiveHash(directive: SearchDirective): string {
  return JSON.stringify({
    ...directive,
    intolerances: [...directive.intolerances].sort(),
    exclude_ingredients: [...directive.exclude_ingredients].sort(),
  })
}

export function getQuotaState(input: {
  pointsUsedToday: number
  dailyLimit?: number
  threshold?: number
}) {
  const dailyLimit = input.dailyLimit ?? DEFAULT_SPOONACULAR_DAILY_LIMIT
  const threshold = input.threshold ?? DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD
  const thresholdPoints = Math.ceil(dailyLimit * threshold)

  return {
    daily_limit: dailyLimit,
    points_used_today: input.pointsUsedToday,
    threshold_points: thresholdPoints,
    threshold_reached: input.pointsUsedToday >= thresholdPoints,
  }
}

export async function fetchComplexSearch(args: {
  directive: SearchDirective
  apiKey: string
}): Promise<Response> {
  const url = new URL('https://api.spoonacular.com/recipes/complexSearch')
  url.searchParams.set('query', args.directive.query)
  url.searchParams.set('type', args.directive.meal_type)
  url.searchParams.set('instructionsRequired', 'true')
  url.searchParams.set('fillIngredients', 'true')
  url.searchParams.set('addRecipeInformation', 'true')
  url.searchParams.set('addRecipeNutrition', 'true')
  url.searchParams.set('number', '2')

  if (args.directive.cuisine) {
    url.searchParams.set('cuisine', args.directive.cuisine)
  }

  if (args.directive.diet) {
    url.searchParams.set('diet', args.directive.diet)
  }

  if (args.directive.intolerances.length > 0) {
    url.searchParams.set('intolerances', args.directive.intolerances.join(','))
  }

  if (args.directive.exclude_ingredients.length > 0) {
    url.searchParams.set('excludeIngredients', args.directive.exclude_ingredients.join(','))
  }

  if (typeof args.directive.min_calories === 'number') {
    url.searchParams.set('minCalories', String(args.directive.min_calories))
  }

  if (typeof args.directive.max_calories === 'number') {
    url.searchParams.set('maxCalories', String(args.directive.max_calories))
  }

  return fetch(url, {
    headers: {
      'x-api-key': args.apiKey,
    },
  })
}

export async function loadCachedRecipe(
  serviceClient: SupabaseClient,
  directiveHash: string,
) {
  const nowIso = new Date().toISOString()
  const { data, error } = await serviceClient
    .from('recipe_cache_directive_lookup')
    .select(`
      directive_hash,
      spoonacular_id,
      expires_at,
      recipe_cache:recipe_cache!inner(
        spoonacular_id,
        title,
        ready_in_minutes,
        servings,
        image_url,
        raw_data,
        created_at,
        expires_at
      )
    `)
    .eq('directive_hash', directiveHash)
    .gt('expires_at', nowIso)
    .gt('recipe_cache.expires_at', nowIso)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load cached recipe: ${error.message}`)
  }

  if (!data?.recipe_cache) {
    return null
  }

  return {
    directive_hash: data.directive_hash,
    spoonacular_id: data.spoonacular_id,
    expires_at: data.expires_at,
    recipe: data.recipe_cache.raw_data as SpoonacularRecipeResult,
  }
}

export async function upsertRecipeCache(serviceClient: SupabaseClient, payload: {
  directiveHash: string
  recipe: SpoonacularRecipeResult
}) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const { error: recipeError } = await serviceClient
    .from('recipe_cache')
    .upsert({
      spoonacular_id: payload.recipe.id,
      title: payload.recipe.title,
      ready_in_minutes: payload.recipe.readyInMinutes ?? null,
      servings: payload.recipe.servings ?? null,
      image_url: payload.recipe.image ?? null,
      raw_data: payload.recipe,
      expires_at: expiresAt,
    }, {
      onConflict: 'spoonacular_id',
    })

  if (recipeError) {
    throw new Error(`Failed to upsert recipe cache row: ${recipeError.message}`)
  }

  const { error: lookupError } = await serviceClient
    .from('recipe_cache_directive_lookup')
    .upsert({
      directive_hash: payload.directiveHash,
      spoonacular_id: payload.recipe.id,
      expires_at: expiresAt,
    }, {
      onConflict: 'directive_hash',
    })

  if (lookupError) {
    throw new Error(`Failed to upsert recipe cache directive lookup: ${lookupError.message}`)
  }
}

export async function writeUsageLog(serviceClient: SupabaseClient, payload: {
  household_id: string
  endpoint: string
  directive_hash: string | null
  points_requested: number
  points_used_today: number
  points_left_today: number
  daily_limit: number
  status_code: number
}) {
  try {
    const { error } = await serviceClient
      .from('spoonacular_usage_log')
      .insert({
        household_id: payload.household_id,
        endpoint: payload.endpoint,
        directive_hash: payload.directive_hash,
        points_requested: payload.points_requested,
        points_used_today: payload.points_used_today,
        points_left_today: payload.points_left_today,
        daily_limit: payload.daily_limit,
        status_code: payload.status_code,
      })

    if (error) {
      console.error('[spoonacular] Usage log insert failed (non-fatal):', error)
    }
  } catch (error) {
    console.error('[spoonacular] Usage log insert threw (non-fatal):', error)
  }
}
