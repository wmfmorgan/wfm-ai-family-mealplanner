import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.40.0"

import { callAI, type AICallOptions, type AICallResult } from '../_shared/ai-client.ts'
import {
  corsHeaders,
  createServiceClient,
  createUserClient,
  type AuthResult,
  verifyAuth,
} from '../_shared/auth.ts'
import { matchesAllergenTaxonomy } from '../_shared/allergen-taxonomy.ts'
import {
  buildDirectiveHash,
  getDefaultDailyLimit,
  DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD,
  fetchComplexSearch,
  getQuotaState,
  loadCachedRecipe,
  type SearchDirective,
  type SpoonacularIngredient,
  type SpoonacularRecipeResult,
  upsertRecipeCache,
  writeUsageLog,
} from '../_shared/spoonacular.ts'

type RecipeSearchRequest = {
  household_id?: string
  week_start_date?: string
  directives?: SearchDirective[]
}

type NormalizedShoppingItem = {
  original_string: string
  category: string
  aisle: string | null
  amount: number | null
  unit: string | null
}

type NormalizedRecipe = {
  name: string
  description: string
  ingredients: unknown[]
  instructions: unknown[]
  nutrition: Record<string, unknown>
  prep_time_min: number
  cook_time_min: number
  servings: number
  source_provider: 'spoonacular' | 'ai-generated'
  source_id: string | null
  image_url: string | null
}

type SlotResponse = {
  day: number
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  recipe: NormalizedRecipe
  shopping_items: NormalizedShoppingItem[]
  fallback_reason: string | null
}

type RecipeSearchResponse = {
  week_start_date: string
  quota_status: ReturnType<typeof getQuotaState>
  slots: SlotResponse[]
}

type UsageRow = {
  points_requested: number | null
  points_used_today: number | null
}

type FallbackPayload = {
  recipe?: Record<string, unknown>
  shopping_items?: Array<Record<string, unknown>>
} & Record<string, unknown>

type HandlerDependencies = {
  verifyAuth: (req: Request) => Promise<AuthResult | Response>
  createUserClient: (authHeader: string) => SupabaseClient
  createServiceClient: () => SupabaseClient
  loadQuotaUsage: (serviceClient: SupabaseClient, householdId: string) => Promise<UsageRow[]>
  loadCachedRecipe: typeof loadCachedRecipe
  fetchComplexSearch: typeof fetchComplexSearch
  writeUsageLog: typeof writeUsageLog
  upsertRecipeCache: typeof upsertRecipeCache
  callAI: (options: AICallOptions) => Promise<AICallResult>
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function errorResponse(status: number, error: string): Response {
  return jsonResponse({ error }, { status })
}

function normalizeShoppingItem(input: SpoonacularIngredient): NormalizedShoppingItem {
  const aisle = typeof input.aisle === 'string' && input.aisle.trim()
    ? input.aisle.trim()
    : null
  const original = typeof input.original === 'string' && input.original.trim()
    ? input.original.trim()
    : typeof input.nameClean === 'string' && input.nameClean.trim()
    ? input.nameClean.trim()
    : typeof input.name === 'string' && input.name.trim()
    ? input.name.trim()
    : 'Unknown ingredient'

  return {
    original_string: original,
    category: aisle ?? 'Other',
    aisle,
    amount: typeof input.amount === 'number' && Number.isFinite(input.amount) ? input.amount : null,
    unit: typeof input.unit === 'string' && input.unit.trim() ? input.unit.trim() : null,
  }
}

function normalizeInstructions(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const steps = (entry as { steps?: unknown[] }).steps
    return Array.isArray(steps) ? steps : [entry]
  })
}

function normalizeProviderSlot(directive: SearchDirective, recipe: SpoonacularRecipeResult): SlotResponse {
  const ingredients = Array.isArray(recipe.extendedIngredients) ? recipe.extendedIngredients : []
  const prepTime = typeof recipe.preparationMinutes === 'number'
    ? recipe.preparationMinutes
    : typeof recipe.readyInMinutes === 'number'
    ? recipe.readyInMinutes
    : 0
  const cookTime = typeof recipe.cookingMinutes === 'number'
    ? recipe.cookingMinutes
    : typeof recipe.readyInMinutes === 'number'
    ? Math.max(recipe.readyInMinutes - prepTime, 0)
    : 0

  return {
    day: directive.day,
    meal_type: directive.meal_type,
    recipe: {
      name: recipe.title,
      description: 'Grounded recipe from Spoonacular',
      ingredients,
      instructions: normalizeInstructions(recipe.analyzedInstructions),
      nutrition: recipe.nutrition ?? {},
      prep_time_min: prepTime,
      cook_time_min: cookTime,
      servings: typeof recipe.servings === 'number' ? recipe.servings : 1,
      source_provider: 'spoonacular',
      source_id: String(recipe.id),
      image_url: recipe.image ?? null,
    },
    shopping_items: ingredients.map(normalizeShoppingItem),
    fallback_reason: null,
  }
}

function normalizeFallbackShoppingItem(
  input: Record<string, unknown>,
  mealType: SearchDirective['meal_type'],
): NormalizedShoppingItem {
  const original = typeof input.original_string === 'string' && input.original_string.trim()
    ? input.original_string.trim()
    : typeof input.name === 'string' && input.name.trim()
    ? input.name.trim()
    : 'AI generated ingredient'
  const category = typeof input.category === 'string' && input.category.trim()
    ? input.category.trim()
    : mealType[0].toUpperCase() + mealType.slice(1)

  return {
    original_string: original,
    category,
    aisle: null,
    amount: null,
    unit: null,
  }
}

function normalizeFallbackSlot(
  directive: SearchDirective,
  payload: FallbackPayload,
  reason: string,
): SlotResponse {
  const recipeRecord = (payload.recipe && typeof payload.recipe === 'object')
    ? payload.recipe
    : payload
  const shoppingItems = Array.isArray(payload.shopping_items)
    ? payload.shopping_items
    : Array.isArray(recipeRecord.ingredients)
    ? recipeRecord.ingredients
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          original_string: typeof item.original_string === 'string'
            ? item.original_string
            : typeof item.name === 'string'
            ? item.name
            : 'AI generated ingredient',
          category: directive.meal_type[0].toUpperCase() + directive.meal_type.slice(1),
        }))
    : []

  return {
    day: directive.day,
    meal_type: directive.meal_type,
    recipe: {
      name: typeof recipeRecord.name === 'string' && recipeRecord.name.trim()
        ? recipeRecord.name.trim()
        : `${directive.query} fallback`,
      description: typeof recipeRecord.description === 'string' && recipeRecord.description.trim()
        ? recipeRecord.description.trim()
        : 'AI-generated fallback recipe',
      ingredients: Array.isArray(recipeRecord.ingredients) ? recipeRecord.ingredients : [],
      instructions: Array.isArray(recipeRecord.instructions) ? recipeRecord.instructions : [],
      nutrition: recipeRecord.nutrition && typeof recipeRecord.nutrition === 'object'
        ? recipeRecord.nutrition as Record<string, unknown>
        : {},
      prep_time_min: typeof recipeRecord.prep_time_min === 'number' ? recipeRecord.prep_time_min : 0,
      cook_time_min: typeof recipeRecord.cook_time_min === 'number' ? recipeRecord.cook_time_min : 0,
      servings: typeof recipeRecord.servings === 'number' ? recipeRecord.servings : 1,
      source_provider: 'ai-generated',
      source_id: null,
      image_url: null,
    },
    shopping_items: shoppingItems.map((item) => normalizeFallbackShoppingItem(item, directive.meal_type)),
    fallback_reason: reason,
  }
}

function ingredientNamesForRecipe(recipe: SpoonacularRecipeResult): string[] {
  return (recipe.extendedIngredients ?? [])
    .flatMap((ingredient) => {
      const values = [
        ingredient.nameClean,
        ingredient.name,
        ingredient.original,
      ]

      return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    })
}

function buildRelaxedQueries(query: string): string[] {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length <= 2) {
    return []
  }

  const variants = [
    words.slice(0, 2).join(' '),
    words.slice(-2).join(' '),
  ]

  return Array.from(new Set(variants.filter((value) => value !== query)))
}

export function buildSearchDirectiveAttempts(directive: SearchDirective): SearchDirective[] {
  const attempts: SearchDirective[] = [
    directive,
    { ...directive, cuisine: null },
    { ...directive, min_calories: null, max_calories: null },
    { ...directive, cuisine: null, min_calories: null, max_calories: null },
  ]

  for (const query of buildRelaxedQueries(directive.query)) {
    attempts.push(
      { ...directive, query },
      { ...directive, query, cuisine: null },
      { ...directive, query, min_calories: null, max_calories: null },
      { ...directive, query, cuisine: null, min_calories: null, max_calories: null },
    )
  }

  const seen = new Set<string>()
  return attempts.filter((attempt) => {
    const key = JSON.stringify(attempt)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function selectCompliantCandidate(
  candidates: SpoonacularRecipeResult[],
  directive: SearchDirective,
) {
  return candidates.find((candidate) =>
    !matchesAllergenTaxonomy(ingredientNamesForRecipe(candidate), directive.intolerances))
}

function parseFallbackContent(content: string): FallbackPayload {
  const parsed = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Fallback generator must return a JSON object')
  }
  return parsed as FallbackPayload
}

async function buildFallbackSlot(
  deps: HandlerDependencies,
  directive: SearchDirective,
  householdId: string,
  reason: string,
): Promise<SlotResponse> {
  const aiResult = await deps.callAI({
    role: 'fallback-generator',
    edgeFunction: 'recipe-search',
    householdId,
    responseFormat: { type: 'json_object' },
    systemPrompt: [
      'Return JSON only.',
      'Provide a top-level "recipe" object and optional "shopping_items" array.',
      'Do not include image_url, source_id, aisle, amount, or unit values.',
    ].join(' '),
    userPrompt: JSON.stringify({
      directive,
      fallback_reason: reason,
    }),
  })

  return normalizeFallbackSlot(directive, parseFallbackContent(aiResult.content), reason)
}

function parseQuotaNumber(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parseQuotaHeaders(
  response: Response,
  fallbackPointsUsedToday: number,
  dailyLimit = getDefaultDailyLimit(),
) {
  const pointsRequested = parseQuotaNumber(
    response.headers.get('X-API-Quota-Request'),
    0,
  )
  const pointsUsedToday = parseQuotaNumber(
    response.headers.get('X-API-Quota-Used'),
    fallbackPointsUsedToday,
  )
  const pointsLeftToday = parseQuotaNumber(
    response.headers.get('X-API-Quota-Left'),
    Math.max(dailyLimit - pointsUsedToday, 0),
  )

  return {
    points_requested: pointsRequested,
    points_used_today: pointsUsedToday,
    points_left_today: pointsLeftToday,
  }
}

function computePointsUsedToday(rows: UsageRow[]): number {
  if (rows.length === 0) {
    return 0
  }

  const maxPointsUsedToday = rows.reduce((max, row) =>
    Math.max(max, row.points_used_today ?? 0), 0)
  if (maxPointsUsedToday > 0) {
    return maxPointsUsedToday
  }

  return rows.reduce((sum, row) => sum + (row.points_requested ?? 0), 0)
}

async function defaultLoadQuotaUsage(serviceClient: SupabaseClient, householdId: string) {
  const now = new Date()
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  ))
  const endOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23,
    59,
    59,
    999,
  ))

  const { data, error } = await serviceClient
    .from('spoonacular_usage_log')
    .select('points_requested, points_used_today')
    .eq('household_id', householdId)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())

  if (error) {
    throw new Error(`Failed to load quota usage: ${error.message}`)
  }

  return (data ?? []) as UsageRow[]
}

function validateDirectives(input: unknown): SearchDirective[] | null {
  if (!Array.isArray(input)) {
    return null
  }

  const mealTypes = new Set(['breakfast', 'lunch', 'dinner'])

  const directives = input.filter((directive): directive is SearchDirective => {
    if (!directive || typeof directive !== 'object') {
      return false
    }

    const candidate = directive as SearchDirective
    return Number.isInteger(candidate.day)
      && mealTypes.has(candidate.meal_type)
      && typeof candidate.query === 'string'
      && Array.isArray(candidate.intolerances)
      && Array.isArray(candidate.exclude_ingredients)
  })

  return directives.length === input.length ? directives : null
}

export function createHandler(overrides: Partial<HandlerDependencies> = {}) {
  const deps: HandlerDependencies = {
    verifyAuth,
    createUserClient,
    createServiceClient,
    loadQuotaUsage: defaultLoadQuotaUsage,
    loadCachedRecipe,
    fetchComplexSearch,
    writeUsageLog,
    upsertRecipeCache,
    callAI,
    ...overrides,
  }

  return async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return errorResponse(405, 'Method not allowed')
    }

    try {
      const authResult = await deps.verifyAuth(req)
      if (authResult instanceof Response) {
        return authResult
      }

      const body = await req.json() as RecipeSearchRequest
      const directives = validateDirectives(body.directives)
      if (!body.household_id || !body.week_start_date || !directives) {
        return errorResponse(400, 'household_id, week_start_date, and directives are required')
      }

      const authHeader = authResult.authHeader
      const userClient = deps.createUserClient(authHeader)
      const serviceClient = deps.createServiceClient()
      void userClient

      const usageRows = await deps.loadQuotaUsage(serviceClient, body.household_id)
      const dailyLimit = Number(Deno.env.get('SPOONACULAR_DAILY_LIMIT') ?? getDefaultDailyLimit())
      const threshold = Number(
        Deno.env.get('SPOONACULAR_FALLBACK_THRESHOLD') ?? DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD,
      )
      let quotaStatus = getQuotaState({
        pointsUsedToday: computePointsUsedToday(usageRows),
        dailyLimit,
        threshold,
      })

      const rawApiKey = Deno.env.get('SPOONACULAR_API_KEY')
      const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey
      if (!apiKey) {
        console.warn('[recipe-search] SPOONACULAR_API_KEY is not set — all slots will use AI fallback. Set the secret via: supabase secrets set SPOONACULAR_API_KEY=<your_key>')
      }
      console.log(`[recipe-search] quota_state=${JSON.stringify(quotaStatus)} dailyLimit=${dailyLimit} threshold=${threshold}`)
      const slots: SlotResponse[] = []

      for (const directive of directives) {
        const directiveHash = buildDirectiveHash(directive)
        const cached = await deps.loadCachedRecipe(serviceClient, directiveHash)
        if (cached?.recipe) {
          slots.push(normalizeProviderSlot(directive, cached.recipe))
          continue
        }

        if (quotaStatus.threshold_reached) {
          console.error(`[recipe-search] fallback=quota-threshold-reached day=${directive.day} meal=${directive.meal_type} points_used=${quotaStatus.points_used_today} threshold_points=${quotaStatus.threshold_points}`)
          slots.push(await buildFallbackSlot(
            deps,
            directive,
            body.household_id,
            'quota-threshold-reached',
          ))
          continue
        }

        if (!apiKey) {
          console.error(`[recipe-search] fallback=missing-spoonacular-api-key day=${directive.day} meal=${directive.meal_type}`)
          slots.push(await buildFallbackSlot(
            deps,
            directive,
            body.household_id,
            'missing-spoonacular-api-key',
          ))
          continue
        }

        const attempts = buildSearchDirectiveAttempts(directive)
        let selectedRecipe: SpoonacularRecipeResult | null = null
        let sawAnyCandidates = false
        let fallbackReason: string | null = null

        for (const [attemptIndex, attempt] of attempts.entries()) {
          if (attemptIndex > 0) {
            console.warn(
              `[recipe-search] retrying provider search attempt=${attemptIndex + 1}/${attempts.length} day=${directive.day} meal=${directive.meal_type} query="${attempt.query}" cuisine=${attempt.cuisine ?? 'null'} min=${attempt.min_calories ?? 'null'} max=${attempt.max_calories ?? 'null'}`,
            )
          }

          const providerResponse = await deps.fetchComplexSearch({
            directive: attempt,
            apiKey,
          })

          const quotaHeaders = parseQuotaHeaders(
            providerResponse,
            quotaStatus.points_used_today,
            dailyLimit,
          )
          await deps.writeUsageLog(serviceClient, {
            household_id: body.household_id,
            endpoint: '/recipes/complexSearch',
            directive_hash: directiveHash,
            points_requested: quotaHeaders.points_requested,
            points_used_today: quotaHeaders.points_used_today,
            points_left_today: quotaHeaders.points_left_today,
            daily_limit: dailyLimit,
            status_code: providerResponse.status,
          })

          quotaStatus = getQuotaState({
            pointsUsedToday: quotaHeaders.points_used_today,
            dailyLimit,
            threshold,
          })

          if (providerResponse.status === 402) {
            fallbackReason = 'provider-quota-exhausted'
            break
          }

          if (!providerResponse.ok) {
            fallbackReason = `provider-error-${providerResponse.status}`
            break
          }

          const providerPayload = await providerResponse.json() as { results?: SpoonacularRecipeResult[] }
          const candidates = Array.isArray(providerPayload.results) ? providerPayload.results : []
          if (candidates.length > 0) {
            sawAnyCandidates = true
          }

          const compliantCandidate = selectCompliantCandidate(candidates, directive)
          if (compliantCandidate) {
            selectedRecipe = compliantCandidate
            break
          }
        }

        if (!selectedRecipe) {
          const resolvedFallbackReason = fallbackReason ?? (
            sawAnyCandidates ? 'taxonomy-rejected-all-candidates' : 'provider-no-results'
          )
          console.error(`[recipe-search] fallback=${resolvedFallbackReason} day=${directive.day} meal=${directive.meal_type} query="${directive.query}"`)
          slots.push(await buildFallbackSlot(
            deps,
            directive,
            body.household_id,
            resolvedFallbackReason,
          ))
          continue
        }

        await deps.upsertRecipeCache(serviceClient, {
          directiveHash,
          recipe: selectedRecipe,
        })
        slots.push(normalizeProviderSlot(directive, selectedRecipe))
      }

      const responseBody: RecipeSearchResponse = {
        week_start_date: body.week_start_date,
        quota_status: quotaStatus,
        slots,
      }

      return jsonResponse(responseBody, { status: 200 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return errorResponse(500, message)
    }
  }
}

serve(createHandler())
