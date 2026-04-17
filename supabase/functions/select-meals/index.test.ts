import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { createHandler } from './index.ts'

const authHeader = 'Bearer test-token'

const buildRequest = (body: unknown) =>
  new Request('http://localhost/select-meals', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

const baseMembers = [
  {
    name: 'Alice',
    nutrition_profile: {
      target_calories: 2000,
      dietary_choice: 'vegetarian',
      allergies: ['tree nuts'],
      avoidances: ['anchovy'],
      cooking_skill: 'intermediate',
    },
  },
]

Deno.test('SEARCH-02: falls back to persisted generation_preferences.matrix', async () => {
  let capturedUserPrompt = ''

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    loadGenerationPreferences: async () => ({
      matrix: {
        '1': ['dinner'],
      },
    }),
    callAI: async (options) => {
      capturedUserPrompt = options.userPrompt
      return {
        content: JSON.stringify({
          directives: [
            {
              day: 1,
              meal_type: 'dinner',
              query: 'lentil pasta bake',
              cuisine: null,
              diet: 'vegetarian',
              min_calories: 500,
              max_calories: 650,
              intolerances: ['tree nuts'],
              exclude_ingredients: ['anchovy'],
              fallback_reason: null,
            },
          ],
          recipes: [{ name: 'Should not leak' }],
        }),
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'test',
        model: 'test',
      }
    },
  })

  const response = await handler(buildRequest({
    household_id: 'household-1',
    members: baseMembers,
    week_start_date: '2026-04-19',
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(payload.matrix, { '1': ['dinner'] })
  assertEquals(payload.directives.length, 1)
  assertEquals(payload.directives[0].day, 1)
  assertEquals(payload.directives[0].meal_type, 'dinner')
  assertEquals('recipes' in payload, false)
  assertEquals(capturedUserPrompt.includes('"1":["dinner"]'), true)
})

Deno.test('SEARCH-02: explicit request matrix overrides persisted preferences', async () => {
  let capturedRole = ''

  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    loadGenerationPreferences: async () => ({
      matrix: {
        '0': ['breakfast', 'lunch', 'dinner'],
      },
    }),
    callAI: async (options) => {
      capturedRole = options.role
      return {
        content: JSON.stringify({
          directives: [
            {
              day: 3,
              meal_type: 'breakfast',
              query: 'savory oatmeal bowl',
              cuisine: null,
              diet: null,
              min_calories: 350,
              max_calories: 500,
              intolerances: ['tree nuts'],
              exclude_ingredients: ['anchovy'],
              fallback_reason: null,
            },
          ],
        }),
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'test',
        model: 'test',
      }
    },
  })

  const response = await handler(buildRequest({
    household_id: 'household-1',
    members: baseMembers,
    week_start_date: '2026-04-19',
    matrix: {
      '3': ['breakfast'],
    },
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(payload.matrix, { '3': ['breakfast'] })
  assertEquals(payload.directives[0].day, 3)
  assertEquals(payload.directives[0].meal_type, 'breakfast')
  assertEquals(capturedRole, 'coordinator')
})

Deno.test('SEARCH-02: sparse matrix preserves exact cells only', async () => {
  const handler = createHandler({
    verifyAuth: async () => ({ user: { id: 'user-1' }, authHeader }),
    loadGenerationPreferences: async () => ({
      matrix: {
        '0': ['breakfast'],
      },
    }),
    callAI: async () => ({
      content: JSON.stringify({
        directives: [
          {
            day: 1,
            meal_type: 'dinner',
            query: 'sheet pan salmon',
            cuisine: null,
            diet: null,
            min_calories: 500,
            max_calories: 650,
            intolerances: [],
            exclude_ingredients: [],
            fallback_reason: null,
          },
          {
            day: 3,
            meal_type: 'breakfast',
            query: 'overnight oats',
            cuisine: null,
            diet: 'vegetarian',
            min_calories: 300,
            max_calories: 450,
            intolerances: [],
            exclude_ingredients: [],
            fallback_reason: null,
          },
        ],
      }),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'test',
      model: 'test',
    }),
  })

  const response = await handler(buildRequest({
    household_id: 'household-1',
    members: baseMembers,
    week_start_date: '2026-04-19',
    matrix: {
      '1': ['dinner'],
      '3': ['breakfast'],
    },
  }))
  const payload = await response.json()

  assertEquals(response.status, 200)
  assertEquals(payload.matrix, { '1': ['dinner'], '3': ['breakfast'] })
  assertEquals(payload.directives.map((directive: { day: number; meal_type: string }) => [
    directive.day,
    directive.meal_type,
  ]), [[1, 'dinner'], [3, 'breakfast']])
})
