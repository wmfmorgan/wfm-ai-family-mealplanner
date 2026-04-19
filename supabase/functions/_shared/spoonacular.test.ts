import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import {
  buildDirectiveHash,
  getDefaultDailyLimit,
  DEFAULT_SPOONACULAR_FALLBACK_THRESHOLD,
  fetchComplexSearch,
  getQuotaState,
  resolveComplexSearchDiet,
  resolveComplexSearchIntolerances,
  resolveComplexSearchType,
} from './spoonacular.ts'

const directive = {
  day: 0,
  meal_type: 'breakfast' as const,
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

Deno.test('SEARCH-04: lunch and dinner map to Spoonacular main course type', () => {
  assertEquals(resolveComplexSearchType('breakfast'), 'breakfast')
  assertEquals(resolveComplexSearchType('lunch'), 'main course')
  assertEquals(resolveComplexSearchType('dinner'), 'main course')
})

Deno.test('SEARCH-04: household diet labels normalize to supported Spoonacular diets', () => {
  assertEquals(resolveComplexSearchDiet('Vegetarian'), 'vegetarian')
  assertEquals(resolveComplexSearchDiet('Pescatarian'), 'pescetarian')
  assertEquals(resolveComplexSearchDiet('Keto'), 'ketogenic')
  assertEquals(resolveComplexSearchDiet('Standard'), null)
  assertEquals(resolveComplexSearchDiet('Low-Carb'), null)
})

Deno.test('SEARCH-04: household allergy labels normalize to supported Spoonacular intolerances', () => {
  assertEquals(
    resolveComplexSearchIntolerances(['Milk', 'Peanuts', 'Tree Nuts', 'Fish', 'Sesame']),
    ['dairy', 'peanut', 'tree nut', 'seafood', 'sesame'],
  )
})

Deno.test('SEARCH-04: fetchComplexSearch uses provider-valid type values', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''

  globalThis.fetch = ((input: string | URL | Request) => {
    capturedUrl = String(input)
    return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }))
  }) as typeof fetch

  try {
    await fetchComplexSearch({
      directive: {
        ...directive,
        meal_type: 'dinner',
        diet: 'Keto',
        intolerances: ['Milk', 'Tree Nuts', 'Peanuts'],
      },
      apiKey: 'test-key',
    })

    const url = new URL(capturedUrl)
    assertEquals(url.searchParams.get('type'), 'main course')
    assertEquals(url.searchParams.get('diet'), 'ketogenic')
    assertEquals(url.searchParams.get('intolerances'), 'dairy,tree nut,peanut')
  } finally {
    globalThis.fetch = originalFetch
  }
})
