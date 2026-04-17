import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { createHandler } from './index.ts'

const authHeader = 'Bearer test-token'

const directiveA = {
  day: 1,
  meal_type: 'dinner' as const,
  query: 'chicken bowls',
  cuisine: null,
  diet: null,
  min_calories: 450,
  max_calories: 650,
  intolerances: [],
  exclude_ingredients: [],
  fallback_reason: null,
}

const directiveB = {
  day: 2,
  meal_type: 'lunch' as const,
  query: 'veggie wraps',
  cuisine: null,
  diet: null,
  min_calories: 350,
  max_calories: 550,
  intolerances: [],
  exclude_ingredients: [],
  fallback_reason: null,
}

const groundedRecipe = {
  id: 100,
  title: 'Grounded Bowl',
  readyInMinutes: 30,
  preparationMinutes: 10,
  cookingMinutes: 20,
  servings: 4,
  image: 'https://example.com/grounded.jpg',
  extendedIngredients: [
    {
      original: '1 head broccoli',
      aisle: 'Produce',
      amount: 1,
      unit: 'head',
      name: 'broccoli',
      nameClean: 'broccoli',
    },
  ],
}

const fallbackContent = JSON.stringify({
  recipe: {
    name: 'AI Wraps',
    description: 'Fallback lunch',
    ingredients: [{ name: 'tortillas' }],
    instructions: [{ step: 'Fill wraps' }],
    nutrition: {},
    prep_time_min: 10,
    cook_time_min: 5,
    servings: 2,
  },
  shopping_items: [{ original_string: '4 tortillas', category: 'Pantry' }],
})

const buildRequest = (body: unknown) =>
  new Request('http://localhost/recipe-search', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

function createSupabaseStub() {
  return {} as never
}

Deno.test('SEARCH-05: later directive falls back after earlier live fetch crosses threshold', async () => {
  let providerCalls = 0

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [{ points_requested: 0, points_used_today: 38 }],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async () => {
      providerCalls += 1
      return new Response(JSON.stringify({ results: [groundedRecipe] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Quota-Request': '2',
          'X-API-Quota-Used': '40',
          'X-API-Quota-Left': '10',
        },
      })
    },
    writeUsageLog: async () => undefined,
    upsertRecipeCache: async () => undefined,
    callAI: async () => ({
      content: fallbackContent,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'test',
      model: 'test',
    }),
  })

  const previousLimit = Deno.env.get('SPOONACULAR_DAILY_LIMIT')
  try {
    Deno.env.set('SPOONACULAR_DAILY_LIMIT', '50')
    const response = await handler(buildRequest({
      household_id: 'household-1',
      week_start_date: '2026-04-19',
      directives: [directiveA, directiveB],
    }))
    const payload = await response.json()

    assertEquals(response.status, 200)
    assertEquals(providerCalls, 1)
    assertEquals(payload.slots[0].recipe.source_provider, 'spoonacular')
    assertEquals(payload.slots[1].recipe.source_provider, 'ai-generated')
  } finally {
    if (previousLimit === undefined) Deno.env.delete('SPOONACULAR_DAILY_LIMIT')
    else Deno.env.set('SPOONACULAR_DAILY_LIMIT', previousLimit)
  }
})

Deno.test('SEARCH-05: provider 402 converts only the affected directive to source_provider ai-generated', async () => {
  let providerCalls = 0

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async ({ directive }) => {
      providerCalls += 1
      if (directive.day === 1) {
        return new Response(JSON.stringify({ results: [groundedRecipe] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Quota-Request': '1',
            'X-API-Quota-Used': '10',
            'X-API-Quota-Left': '40',
          },
        })
      }

      return new Response(JSON.stringify({ error: 'Payment Required' }), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Quota-Request': '1',
          'X-API-Quota-Used': '41',
          'X-API-Quota-Left': '9',
        },
      })
    },
    writeUsageLog: async () => undefined,
    upsertRecipeCache: async () => undefined,
    callAI: async () => ({
      content: fallbackContent,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'test',
      model: 'test',
    }),
  })

  const response = await handler(buildRequest({
    household_id: 'household-1',
    week_start_date: '2026-04-19',
    directives: [directiveA, directiveB],
  }))
  const payload = await response.json()
  const expectedFallbackRecipe = { source_provider: 'ai-generated' }

  assertEquals(providerCalls, 2)
  assertEquals(payload.slots[0].recipe.source_provider, 'spoonacular')
  assertEquals(payload.slots[1].recipe.source_provider, expectedFallbackRecipe.source_provider)
  assertEquals(payload.slots[1].recipe.source_provider, 'ai-generated')
})

Deno.test('SEARCH-05: zero surviving grounded candidates after taxonomy filtering produce labeled fallback output', async () => {
  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async () => new Response(JSON.stringify({
      results: [{
        ...groundedRecipe,
        extendedIngredients: [
          {
            original: '1 cup almond flour',
            aisle: 'Baking',
            amount: 1,
            unit: 'cup',
            name: 'almond flour',
            nameClean: 'almond flour',
          },
        ],
      }],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Quota-Request': '1',
        'X-API-Quota-Used': '10',
        'X-API-Quota-Left': '40',
      },
    }),
    writeUsageLog: async () => undefined,
    upsertRecipeCache: async () => undefined,
    callAI: async () => ({
      content: fallbackContent,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'test',
      model: 'test',
    }),
  })

  const response = await handler(buildRequest({
    household_id: 'household-1',
    week_start_date: '2026-04-19',
    directives: [{ ...directiveA, intolerances: ['tree nuts'] }],
  }))
  const payload = await response.json()

  assertEquals(payload.slots[0].recipe.source_provider, 'ai-generated')
  assertEquals(payload.slots[0].recipe.source_id, null)
})
