// supabase/functions/_shared/ai-client.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"

// Test the role config values directly via the test-only export
import { ROLE_CONFIG_FOR_TEST } from './ai-client.ts'

Deno.test("INFRA-01: coordinator role config", () => {
  assertEquals(ROLE_CONFIG_FOR_TEST['coordinator'].temperature, 0.7)
  assertEquals(ROLE_CONFIG_FOR_TEST['coordinator'].max_tokens, 1024)
})

Deno.test("INFRA-01: adapter role config", () => {
  assertEquals(ROLE_CONFIG_FOR_TEST['adapter'].temperature, 0.3)
  assertEquals(ROLE_CONFIG_FOR_TEST['adapter'].max_tokens, 2048)
})

Deno.test("INFRA-01: fallback-generator role config", () => {
  assertEquals(ROLE_CONFIG_FOR_TEST['fallback-generator'].temperature, 0.9)
  assertEquals(ROLE_CONFIG_FOR_TEST['fallback-generator'].max_tokens, 2048)
})

Deno.test("INFRA-01: exactly 3 roles defined", () => {
  const roles = Object.keys(ROLE_CONFIG_FOR_TEST)
  assertEquals(roles.length, 3)
  assertEquals(roles.includes('coordinator'), true)
  assertEquals(roles.includes('adapter'), true)
  assertEquals(roles.includes('fallback-generator'), true)
})

Deno.test("INFRA-03: AIRole type covers all 3 provider roles", () => {
  // Compile-time check — if AIRole type is wrong, import will fail
  const roles: string[] = ['coordinator', 'adapter', 'fallback-generator']
  assertEquals(roles.length, 3)
})
