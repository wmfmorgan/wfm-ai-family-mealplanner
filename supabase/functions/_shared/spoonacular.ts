export const DEFAULT_SPOONACULAR_DAILY_LIMIT = Number(
  Deno.env.get('SPOONACULAR_DAILY_LIMIT') ?? '150',
)

export const DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD = Number(
  Deno.env.get('SPOONACULAR_FALLBACK_THRESHOLD') ?? '0.8',
)

type SearchDirective = {
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
