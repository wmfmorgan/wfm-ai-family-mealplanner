import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { createHandler } from './index.ts'

const authHeader = 'Bearer test-token'

const baseDirective = {
  day: 1,
  meal_type: 'dinner' as const,
  query: 'one pan lemon chicken',
  cuisine: null,
  diet: null,
  min_calories: 450,
  max_calories: 650,
  intolerances: [],
  exclude_ingredients: [],
  fallback_reason: null,
}

const groundedRecipe = {
  id: 716429,
  title: 'One-Pan Lemon Chicken',
  image: 'https://spoonacular.com/recipeImages/716429-556x370.jpg',
  readyInMinutes: 35,
  preparationMinutes: 15,
  cookingMinutes: 20,
  servings: 4,
  nutrition: { calories: 520 },
  analyzedInstructions: [{ steps: [{ number: 1, step: 'Bake it.' }] }],
  extendedIngredients: [
    {
      original: '2 cups broccoli florets',
      aisle: 'Produce',
      amount: 2,
      unit: 'cups',
      name: 'broccoli',
      nameClean: 'broccoli florets',
    },
  ],
}

const fallbackContent = JSON.stringify({
  recipe: {
    name: 'Fallback Pasta',
    description: 'AI-generated fallback recipe',
    ingredients: [{ name: 'pasta' }],
    instructions: [{ step: 'Boil pasta' }],
    nutrition: { calories: 500 },
    prep_time_min: 10,
    cook_time_min: 15,
    servings: 4,
  },
  shopping_items: [
    {
      original_string: '1 lb pasta',
      category: 'Pantry',
    },
  ],
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

Deno.test('SEARCH-01: cache hit short-circuits provider fetch and usage-log writes', async () => {
  let providerCalls = 0
  let usageLogCalls = 0

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [],
    loadCachedRecipe: async () => ({ recipe: groundedRecipe }),
    fetchComplexSearch: async () => {
      providerCalls += 1
      return new Response('{}')
    },
    writeUsageLog: async () => {
      usageLogCalls += 1
    },
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
    directives: [baseDirective],
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(providerCalls, 0)
  assertEquals(usageLogCalls, 0)
  assertEquals(payload.slots[0].recipe.source_provider, 'spoonacular')
})

Deno.test('SEARCH-01: successful grounded fetch writes cache with the current directive hash', async () => {
  let capturedDirectiveHash = ''

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async () => new Response(JSON.stringify({
      results: [groundedRecipe],
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
    upsertRecipeCache: async (_client, payload) => {
      capturedDirectiveHash = payload.directiveHash
    },
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
    directives: [baseDirective],
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(capturedDirectiveHash.length > 0, true)
  assertEquals(payload.slots[0].recipe.source_provider, 'spoonacular')
  assertEquals(payload.slots[0].shopping_items[0], {
    original_string: '2 cups broccoli florets',
    category: 'Produce',
    aisle: 'Produce',
    amount: 2,
    unit: 'cups',
  })
})

Deno.test('SEARCH-05: threshold preflight uses fallback without provider fetch', async () => {
  let providerCalls = 0

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [{ points_requested: 40, points_used_today: 40 }],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async () => {
      providerCalls += 1
      return new Response('{}')
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
      directives: [baseDirective],
    }))
    const payload = await response.json()

    assertEquals(response.status, 200)
    assertEquals(providerCalls, 0)
    assertEquals(payload.slots[0].recipe.source_provider, 'ai-generated')
  } finally {
    if (previousLimit === undefined) Deno.env.delete('SPOONACULAR_DAILY_LIMIT')
    else Deno.env.set('SPOONACULAR_DAILY_LIMIT', previousLimit)
  }
})

Deno.test('SEARCH-05: provider 402 converts only the affected slot to fallback', async () => {
  let callIndex = 0

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async () => {
      callIndex += 1
      if (callIndex === 1) {
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
    directives: [
      baseDirective,
      { ...baseDirective, day: 2, meal_type: 'lunch', query: 'turkey sandwich' },
    ],
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(payload.slots[0].recipe.source_provider, 'spoonacular')
  assertEquals(payload.slots[1].recipe.source_provider, 'ai-generated')
})

Deno.test('SAFE-05: taxonomy rejects almond flour and falls back', async () => {
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
    directives: [{ ...baseDirective, intolerances: ['tree nuts'] }],
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(payload.slots[0].recipe.source_provider, 'ai-generated')
})

Deno.test('SEARCH-01: successful grounded result returns source_provider spoonacular', async () => {
  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    createUserClient: () => createSupabaseStub(),
    createServiceClient: () => createSupabaseStub(),
    loadQuotaUsage: async () => [],
    loadCachedRecipe: async () => null,
    fetchComplexSearch: async () => new Response(JSON.stringify({
      results: [groundedRecipe],
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
    directives: [baseDirective],
  }))
  const payload = await response.json()

  assertEquals(payload.slots[0].recipe.source_provider, 'spoonacular')
  assertEquals(payload.slots[0].recipe.source_id, '716429')
  assertEquals(payload.slots[0].recipe.image_url, groundedRecipe.image)
})
