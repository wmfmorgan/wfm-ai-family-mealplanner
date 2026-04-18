import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import {
  buildDirectiveHash,
  getDefaultDailyLimit,
  DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD,
  getQuotaState,
} from './spoonacular.ts'

const directive = {
  day: 0,
  meal_type: 'breakfast',
  query: 'greek yogurt bowl',
  cuisine: null,
  diet: 'vegetarian',
  min_calories: 400,
  max_calories: 550,
  intolerances: ['dairy'],
  exclude_ingredients: ['almond', 'walnut'],
  fallback_reason: null,
}

Deno.test('SEARCH-04: default daily limit remains 50', () => {
  assertEquals(getDefaultDailyLimit(), 50)
})

Deno.test('SEARCH-04: default threshold remains 0.8', () => {
  assertEquals(DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD, 0.8)
})

Deno.test('SEARCH-04: buildDirectiveHash is stable', () => {
  assertEquals(buildDirectiveHash(directive), buildDirectiveHash(directive))
})

Deno.test('SEARCH-04: threshold stays false below the limit and true at the limit', () => {
  const belowThreshold = getQuotaState({
    pointsUsedToday: 39,
    dailyLimit: 50,
    threshold: 0.8,
  })
  const atThreshold = getQuotaState({
    pointsUsedToday: 40,
    dailyLimit: 50,
    threshold: 0.8,
  })

  assertEquals(belowThreshold.threshold_points, 40)
  assertEquals(belowThreshold.threshold_reached, false)
  assertEquals(atThreshold.threshold_reached, true)
})
