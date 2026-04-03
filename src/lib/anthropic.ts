import Anthropic from '@anthropic-ai/sdk'
import type { ScanResultV2 } from '@/types'

export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SCAN_SYSTEM_PROMPT = `
Tu es un expert en nutrition.

Analyse la photo et DÉCOMPOSE chaque aliment visible séparément avec sa portion et ses calories propres.

IMPORTANT :
- Identifie EXACTEMENT les aliments visibles
- Sépare l'accompagnement (tô, riz, fufu...) de la sauce ou du plat principal
- Calcule les calories pour la portion estimée de chaque composant
- Si incertain, propose des alternatives

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après :
{
  "meal_name": "nom du repas complet",
  "components": [
    {
      "food_name": "Tô de maïs",
      "estimated_portion_g": 300,
      "calories": 310,
      "protein_g": 6.0,
      "carbs_g": 68.0,
      "fat_g": 1.5,
      "confidence": 88
    },
    {
      "food_name": "Sauce feuilles au poisson fumé",
      "estimated_portion_g": 250,
      "calories": 310,
      "protein_g": 22.5,
      "carbs_g": 8.0,
      "fat_g": 20.5,
      "confidence": 80
    }
  ],
  "total_calories": 620,
  "alternatives": ["Fufu avec sauce égusi", "Banku avec sauce feuilles"],
  "notes": "observations utiles"
}
`

export async function scanMealFromImage(
    imageBase64: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<ScanResultV2> {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            system: SCAN_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType,
                                data: imageBase64,
                            },
                        },
                        {
                            type: 'text',
                            text: 'Analyse ce plat et retourne le JSON nutritionnel décomposé par aliment.',
                        },
                    ],
                },
            ],
        })

        const content = response.content[0]

        if (content.type !== 'text') {
            throw new Error('Réponse IA invalide (non textuelle)')
        }

        const cleanJson = content.text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        let parsed: ScanResultV2

        try {
            parsed = JSON.parse(cleanJson)
        } catch (err) {
            console.error('❌ JSON invalide reçu de Claude:', cleanJson)
            throw new Error('Erreur parsing JSON IA')
        }

        // Validation minimale
        if (!parsed.meal_name || !Array.isArray(parsed.components) || parsed.components.length === 0) {
            throw new Error('Données IA incomplètes ou invalides')
        }

        // Validation de chaque composant
        for (const component of parsed.components) {
            if (
                !component.food_name ||
                typeof component.calories !== 'number' ||
                typeof component.protein_g !== 'number' ||
                typeof component.estimated_portion_g !== 'number'
            ) {
                throw new Error(`Composant IA invalide : ${JSON.stringify(component)}`)
            }
        }

        return parsed

    } catch (error) {
        console.error('❌ Erreur scanMealFromImage:', error)
        throw new Error('Impossible d\'analyser le plat pour le moment')
    }
}
