/**
 * Convertit les IDs de restrictions alimentaires stockés en DB
 * en un fragment de prompt lisible par l'IA.
 */

const RESTRICTION_LABELS: Record<string, string> = {
    arachide: 'arachides / cacahuètes',
    lactose: 'produits laitiers (intolérance au lactose)',
    gluten: 'gluten (blé, orge, seigle)',
    fruits_mer: 'fruits de mer et crustacés',
    porc: 'viande de porc',
    vegetarien: 'viande et poisson (végétarien)',
}

export function buildDietaryContextLine(restrictions: string[] | null | undefined): string {
    if (!restrictions || restrictions.length === 0) return ''

    const labels = restrictions
        .map(id => RESTRICTION_LABELS[id] || id)
        .join(', ')

    return `\n⚠️ RESTRICTIONS ALIMENTAIRES STRICTES : L'utilisateur a les allergies/restrictions suivantes — ${labels}. Tu DOIS impérativement exclure ces aliments de tous tes conseils, menus et suggestions. Ne les mentionne jamais comme option.`
}
