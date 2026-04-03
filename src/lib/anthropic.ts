import Anthropic from '@anthropic-ai/sdk'
import type { ScanResult } from '@/types'

export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SCAN_SYSTEM_PROMPT = `
Tu es un expert en nutrition.

Tu analyses des photos de nourriture.

IMPORTANT :
- Ne suppose PAS que c’est un plat africain
- Identifie EXACTEMENT les aliments visibles
- Si ce sont des pâtes → dis "spaghetti" ou "pâtes"
- Si ce sont du riz → dis "riz"
- Si incertain → propose plusieurs options dans "alternatives"
- Ne force JAMAIS une réponse

Sois précis visuellement.

Retourne UNIQUEMENT un objet JSON valide :
{
  "food_name": "nom exact",
  "food_name_fr": "nom descriptif",
  "estimated_portion_g": 300,
  "calories": 520,
  "protein_g": 18.5,
  "carbs_g": 65.2,
  "fat_g": 12.8,
  "confidence": 87,
  "alternatives": ["option 1", "option 2"],
  "notes": "observations"
}
`

export async function scanMealFromImage(
    imageBase64: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<ScanResult> {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001', // ✅ modèle stable
            max_tokens: 500, // ✅ optimisation coût
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
                            text: 'Analyse ce plat africain et retourne le JSON nutritionnel.',
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

        let parsed: ScanResult

        try {
            parsed = JSON.parse(cleanJson)
        } catch (err) {
            console.error('❌ JSON invalide reçu de Claude:', cleanJson)
            throw new Error('Erreur parsing JSON IA')
        }

        // ✅ Validation minimale
        if (
            !parsed.food_name ||
            typeof parsed.calories !== 'number' ||
            typeof parsed.protein_g !== 'number'
        ) {
            throw new Error('Données IA incomplètes ou invalides')
        }

        return parsed
    } catch (error) {
        console.error('❌ Erreur scanMealFromImage:', error)
        throw new Error('Impossible d’analyser le plat pour le moment')
    }
}