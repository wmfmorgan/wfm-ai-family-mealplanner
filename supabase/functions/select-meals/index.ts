import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

import { callAI, type AICallOptions, type AICallResult } from '../_shared/ai-client.ts'
import {
  corsHeaders,
  createUserClient,
  type AuthResult,
  verifyAuth,
} from '../_shared/auth.ts'

type MealType = 'breakfast' | 'lunch' | 'dinner'

type NutritionProfile = {
  target_calories?: number
  dietary_choice?: string
  allergies?: string[]
  avoidances?: string[]
  cooking_skill?: string
  appliances?: string[]
  is_child?: boolean
}

type HouseholdMember = {
  name: string
  nutrition_profile?: NutritionProfile
}

type SearchDirective = {
  day: number
  meal_type: MealType
  query: string
  cuisine: string | null
  diet: string | null
  min_calories: number | null
  max_calories: number | null
  intolerances: string[]
  exclude_ingredients: string[]
  fallback_reason: string | null
}

type Matrix = Record<string, MealType[]>

type GenerationPreferences = {
  matrix?: Record<string, unknown>
}

type SelectMealsRequest = {
  household_id?: string
  members?: HouseholdMember[]
  week_start_date?: string
  matrix?: Record<string, unknown>
  leftover_strategy?: boolean
}

type HandlerDependencies = {
  verifyAuth: (req: Request) => Promise<AuthResult | Response>
  loadGenerationPreferences: (input: {
    authHeader: string
    householdId: string
  }) => Promise<GenerationPreferences | null>
  callAI: (options: AICallOptions) => Promise<AICallResult>
}

const ALLOWED_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

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

function sanitizeMatrixCandidate(value: Record<string, unknown> | undefined): Matrix {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const normalizedEntries = Object.entries(value)
    .filter(([day]) => /^\d+$/.test(day))
    .map(([day, meals]) => {
      const filteredMeals = Array.isArray(meals)
        ? meals.filter((meal): meal is MealType =>
          typeof meal === 'string' && ALLOWED_MEAL_TYPES.includes(meal as MealType))
        : []

      return [day, Array.from(new Set(filteredMeals))] as const
    })
    .filter(([, meals]) => meals.length > 0)
    .sort(([dayA], [dayB]) => Number(dayA) - Number(dayB))

  return Object.fromEntries(normalizedEntries)
}

function buildDirectiveTargets(matrix: Matrix): Array<{ day: number; meal_type: MealType }> {
  return Object.entries(matrix).flatMap(([day, meals]) =>
    meals.map((meal_type) => ({ day: Number(day), meal_type })))
}

function collectMemberContext(members: HouseholdMember[]) {
  const allergies = new Set<string>()
  const avoidances = new Set<string>()
  const diets = new Set<string>()
  let minCalories: number | null = null
  let maxCalories: number | null = null

  for (const member of members) {
    const profile = member.nutrition_profile ?? {}

    if (typeof profile.target_calories === 'number' && Number.isFinite(profile.target_calories)) {
      minCalories = minCalories === null
        ? profile.target_calories
        : Math.min(minCalories, profile.target_calories)
      maxCalories = maxCalories === null
        ? profile.target_calories
        : Math.max(maxCalories, profile.target_calories)
    }

    if (typeof profile.dietary_choice === 'string' && profile.dietary_choice.trim()) {
      diets.add(profile.dietary_choice.trim())
    }

    for (const allergy of profile.allergies ?? []) {
      if (typeof allergy === 'string' && allergy.trim()) {
        allergies.add(allergy.trim())
      }
    }

    for (const avoidance of profile.avoidances ?? []) {
      if (typeof avoidance === 'string' && avoidance.trim()) {
        avoidances.add(avoidance.trim())
      }
    }
  }

  // When all members share the same target_calories, min === max produces a zero-width
  // range that Spoonacular's complexSearch cannot match. Widen to ±20% of the target
  // so the AI coordinator generates search-friendly min_calories/max_calories in directives.
  const effectiveMin = minCalories !== null && maxCalories !== null && minCalories === maxCalories
    ? Math.round(minCalories * 0.8)
    : minCalories
  const effectiveMax = minCalories !== null && maxCalories !== null && minCalories === maxCalories
    ? Math.round(maxCalories * 1.2)
    : maxCalories

  return {
    allergies: Array.from(allergies).sort(),
    avoidances: Array.from(avoidances).sort(),
    diets: Array.from(diets).sort(),
    calorie_range: {
      min: effectiveMin,
      max: effectiveMax,
    },
  }
}

function normalizeDirective(raw: Record<string, unknown>): SearchDirective | null {
  if (typeof raw.day !== 'number' || !Number.isInteger(raw.day)) {
    return null
  }

  if (typeof raw.meal_type !== 'string' || !ALLOWED_MEAL_TYPES.includes(raw.meal_type as MealType)) {
    return null
  }

  if (typeof raw.query !== 'string' || !raw.query.trim()) {
    return null
  }

  const stringList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []

  const parseCalories = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null

  return {
    day: raw.day,
    meal_type: raw.meal_type as MealType,
    query: raw.query.trim(),
    cuisine: typeof raw.cuisine === 'string' ? raw.cuisine : null,
    diet: typeof raw.diet === 'string' ? raw.diet : null,
    min_calories: parseCalories(raw.min_calories),
    max_calories: parseCalories(raw.max_calories),
    intolerances: stringList(raw.intolerances),
    exclude_ingredients: stringList(raw.exclude_ingredients),
    fallback_reason: typeof raw.fallback_reason === 'string' ? raw.fallback_reason : null,
  }
}

function validateDirectives(raw: unknown, allowedTargets: Array<{ day: number; meal_type: MealType }>) {
  if (!Array.isArray(raw)) {
    throw new Error('Coordinator response must include a directives array')
  }

  const normalizedDirectives = raw
    .map((directive) => directive && typeof directive === 'object'
      ? normalizeDirective(directive as Record<string, unknown>)
      : null)
    .filter((directive): directive is SearchDirective => directive !== null)

  const allowedSet = new Set(allowedTargets.map((target) => `${target.day}:${target.meal_type}`))
  const directiveSet = new Set(normalizedDirectives.map((directive) => `${directive.day}:${directive.meal_type}`))

  if (normalizedDirectives.length !== allowedTargets.length) {
    throw new Error('Coordinator response did not produce directives for every enabled matrix cell')
  }

  for (const directive of normalizedDirectives) {
    if (!allowedSet.has(`${directive.day}:${directive.meal_type}`)) {
      throw new Error('Coordinator response included directives outside the enabled matrix scope')
    }
  }

  if (directiveSet.size !== allowedTargets.length) {
    throw new Error('Coordinator response included duplicate or missing directive targets')
  }

  return normalizedDirectives
}

function buildPrompts(input: {
  householdId: string
  weekStartDate: string
  members: HouseholdMember[]
  matrix: Matrix
  leftoverStrategy: boolean
}) {
  const targets = buildDirectiveTargets(input.matrix)
  const memberContext = collectMemberContext(input.members)

  const systemPrompt = [
    'You are the select-meals coordinator for a household meal planner.',
    'Return JSON only with a top-level "directives" array.',
    'Each directive must include: day, meal_type, query, cuisine, diet, min_calories, max_calories, intolerances, exclude_ingredients, fallback_reason.',
    'Output directives only. Do not return recipes, ingredient lists, instructions, shopping lists, prose, markdown, or commentary.',
    'Treat the provided matrix as the source of truth for enabled day/meal cells. Produce exactly one directive per enabled cell and none for disabled cells.',
    'Every directive must include both min_calories and max_calories as numeric values.',
    'The query field must be 1–4 words maximum — a short ingredient or dish name that a recipe search engine can match reliably (e.g. "chicken stir fry", "pasta bake", "lentil soup"). Never include planning words like "leftovers", "meal prep", "batch cook", "family style", "cook once", or "double batch" in the query field.',
    'If leftover_strategy is true, express it by assigning the same short query to two different slots (signalling cook-once intent) — never by making the query longer or adding planning language.',
    'Set fallback_reason to null for every directive unless there is a genuine search limitation specific to this household.',
  ].join(' ')

  const userPrompt = JSON.stringify({
    household_id: input.householdId,
    week_start_date: input.weekStartDate,
    household_size: input.members.length,
    leftover_strategy: input.leftoverStrategy,
    matrix: input.matrix,
    targets,
    members: input.members,
    household_constraints: memberContext,
  })

  return { systemPrompt, userPrompt }
}

async function defaultLoadGenerationPreferences(input: {
  authHeader: string
  householdId: string
}): Promise<GenerationPreferences | null> {
  const supabase = createUserClient(input.authHeader)
  const { data, error } = await supabase
    .from('households')
    .select('generation_preferences')
    .eq('id', input.householdId)
    .single()

  if (error) {
    throw new Error(`Failed to load household generation_preferences: ${error.message}`)
  }

  return (data?.generation_preferences as GenerationPreferences | null) ?? null
}

export function createHandler(overrides: Partial<HandlerDependencies> = {}) {
  const deps: HandlerDependencies = {
    verifyAuth,
    loadGenerationPreferences: defaultLoadGenerationPreferences,
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

      const body = await req.json() as SelectMealsRequest
      if (!body.household_id || !Array.isArray(body.members) || !body.week_start_date) {
        return errorResponse(400, 'household_id, members, and week_start_date are required')
      }

      const persistedPreferences = await deps.loadGenerationPreferences({
        authHeader: authResult.authHeader,
        householdId: body.household_id,
      })

      const requestMatrix = sanitizeMatrixCandidate(body.matrix)
      const persistedMatrix = sanitizeMatrixCandidate(persistedPreferences?.matrix)
      const finalMatrix = Object.keys(requestMatrix).length > 0 ? requestMatrix : persistedMatrix

      if (Object.keys(finalMatrix).length === 0) {
        return errorResponse(400, 'No generation matrix configured for household')
      }

      const targets = buildDirectiveTargets(finalMatrix)
      const { systemPrompt, userPrompt } = buildPrompts({
        householdId: body.household_id,
        weekStartDate: body.week_start_date,
        members: body.members,
        matrix: finalMatrix,
        leftoverStrategy: body.leftover_strategy ?? true,
      })

      const aiResult = await deps.callAI({
        role: 'coordinator',
        systemPrompt,
        userPrompt,
        responseFormat: { type: 'json_object' },
        edgeFunction: 'select-meals',
        householdId: body.household_id,
      })

      let parsed: { directives?: unknown }
      try {
        parsed = JSON.parse(aiResult.content) as { directives?: unknown }
      } catch {
        return errorResponse(500, 'coordinator_response_truncated')
      }
      const directives = validateDirectives(parsed.directives, targets)

      return jsonResponse({
        week_start_date: body.week_start_date,
        matrix: finalMatrix,
        directives,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown select-meals error'
      return errorResponse(500, message)
    }
  }
}

export const handler = createHandler()

serve(handler)
