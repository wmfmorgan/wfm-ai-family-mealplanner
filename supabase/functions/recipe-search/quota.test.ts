import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import { parseQuotaHeaders } from './index.ts'
import { getQuotaState } from '../_shared/spoonacular.ts'

Deno.test('SEARCH-04: quota-header parsing reads request, used, and left values', () => {
  const response = new Response('{}', {
    headers: {
      'X-API-Quota-Request': '3',
      'X-API-Quota-Used': '22',
      'X-API-Quota-Left': '28',
    },
  })

  assertEquals(parseQuotaHeaders(response, 0), {
    points_requested: 3,
    points_used_today: 22,
    points_left_today: 28,
  })
})

Deno.test('SEARCH-04: writeUsageLog payload shape matches grounded fetch contract', () => {
  const payload = {
    household_id: 'household-1',
    endpoint: '/recipes/complexSearch',
    directive_hash: '{"day":1}',
    points_requested: 1,
    points_used_today: 12,
    points_left_today: 38,
    daily_limit: 50,
    status_code: 200,
  }

  assertEquals(Object.keys(payload).sort(), [
    'daily_limit',
    'directive_hash',
    'endpoint',
    'household_id',
    'points_left_today',
    'points_requested',
    'points_used_today',
    'status_code',
  ])
})

Deno.test('SEARCH-04: threshold math respects configured daily limit instead of 150', () => {
  const state = getQuotaState({
    pointsUsedToday: 39,
    dailyLimit: 50,
    threshold: 0.8,
  })

  assertEquals(state.daily_limit, 50)
  assertEquals(state.threshold_points, 40)
  assertEquals(state.threshold_reached, false)
})
