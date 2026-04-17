import {
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts"

import {
  ALLERGEN_TAXONOMY,
  matchesAllergenTaxonomy,
  normalizeIngredientName,
} from './allergen-taxonomy.ts'

Deno.test('SAFE-05: taxonomy exports locked allergen keys', () => {
  const keys = Object.keys(ALLERGEN_TAXONOMY)
  assertEquals(keys.includes('tree nuts'), true)
  assertEquals(keys.includes('peanut'), true)
  assertEquals(keys.includes('dairy'), true)
  assertEquals(keys.includes('egg'), true)
  assertEquals(keys.includes('soy'), true)
  assertEquals(keys.includes('sesame'), true)
  assertEquals(keys.includes('shellfish'), true)
  assertEquals(keys.includes('fish'), true)
})

Deno.test('SAFE-05: normalizeIngredientName lowercases ingredient tokens', () => {
  assertEquals(normalizeIngredientName('Roasted Almonds'), 'roasted almonds')
})

Deno.test('SAFE-05: matches tree nut ingredients', () => {
  assertEquals(matchesAllergenTaxonomy(['almond flour'], ['tree nuts']), true)
})

Deno.test('SAFE-05: ignores non-matching ingredients', () => {
  assertEquals(matchesAllergenTaxonomy(['chicken breast'], ['tree nuts']), false)
})
