import Anthropic from '@anthropic-ai/sdk'
import type { ScanResult } from '@/types'

export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SCAN_SYSTEM_PROMPT = `Tu es un expert en nutrition spécialisé dans la cuisine africaine subsaharienne.

Tu analyses des photos de plats africains et tu retournes UNIQUEMENT un objet JSON valide, sans aucun texte avant ou après.

Pays couverts : Togo, Côte d'Ivoire, Sénégal, Ghana, Bénin, Burkina Faso, Mali, Nigeria, Cameroun et toute l'Afrique de l'Ouest.

Plats que tu connais bien : fufu, attiéké, riz au gras, thiéboudienne, banku, tô, alloco, akara, sauce arachide, sauce graine, bissap, etc.

Consignes IMPORTANTES :
- Sois précis mais réaliste
- Si tu n'es pas sûr → diminue "confidence"
- N'invente pas des valeurs nutritionnelles irréalistes
- Base-toi sur des portions typiques en Afrique de l’Ouest

Retourne exactement ce format JSON :
{
  "food_name": "nom du plat en français",
  "food_name_fr": "nom complet descriptif",
  "estimated_portion_g": 300,
  "calories": 520,
  "protein_g": 18.5,
  "carbs_g": 65.2,
  "fat_g": 12.8,
  "confidence": 87,
  "alternatives": ["autre plat possible 1", "autre plat possible 2"],
  "notes": "observations utiles"
}`

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