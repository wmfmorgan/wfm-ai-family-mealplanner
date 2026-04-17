export const ALLERGEN_TAXONOMY: Record<string, string[]> = {
  'tree nuts': ['almond', 'cashew', 'hazelnut', 'macadamia', 'pecan', 'pistachio', 'walnut'],
  'peanut': ['peanut', 'groundnut'],
  'dairy': ['butter', 'casein', 'cheese', 'cream', 'milk', 'yogurt'],
  'egg': ['egg', 'albumin', 'mayonnaise'],
  'soy': ['edamame', 'miso', 'soy', 'tamari', 'tofu'],
  'sesame': ['sesame', 'tahini'],
  'shellfish': ['clam', 'crab', 'lobster', 'mussel', 'oyster', 'scallop', 'shrimp'],
  'fish': ['anchovy', 'cod', 'salmon', 'sardine', 'tilapia', 'tuna'],
}

export function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesAllergenTaxonomy(
  ingredientNames: string[],
  allergens: string[],
): boolean {
  const normalizedAllergens = allergens
    .map((allergen) => allergen.toLowerCase().trim())
    .filter(Boolean)

  return ingredientNames.some((ingredientName) => {
    const normalizedIngredient = normalizeIngredientName(ingredientName)

    return normalizedAllergens.some((allergen) => {
      const aliases = ALLERGEN_TAXONOMY[allergen] ?? [allergen]

      return aliases.some((alias) => {
        const normalizedAlias = normalizeIngredientName(alias)
        return normalizedIngredient.includes(normalizedAlias)
      })
    })
  })
}
