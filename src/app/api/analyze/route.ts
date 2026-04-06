import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import type { ScanResultV2, ScanComponent, ScanApiResponse } from "@/types"

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── NORMALIZE ────────────────────────────────────────────────
function normalize(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
}

const SYNONYMS: Record<string, string[]> = {
    spaghetti: ["pasta", "noodles", "nouilles"],
    riz: ["rice"],
    poulet: ["chicken"],
    thon: ["tuna"],
    oeuf: ["egg"],
    to: ["tô", "toh", "pate de mais"],
    fufu: ["foufou", "foo foo"],
    attieke: ["attiéké", "attieke"],
    sauce: ["ragoût", "ragout", "bouillon"],
}

// ─── SCORE ────────────────────────────────────────────────────
function scoreFood(itemName: string, food: any) {
    const input = normalize(itemName)

    const names = [
        food.name_fr,
        food.name_local,
        food.name_en
    ].filter(Boolean).map(normalize)

    let score = 0

    for (const name of names) {
        if (input === name) score += 100
        if (input.includes(name)) score += 50
        if (name.includes(input)) score += 40

        const inputWords = input.split(" ")
        const nameWords = name.split(" ")

        for (const word of inputWords) {
            if (word.length > 2 && nameWords.includes(word)) score += 15
        }

        const syns = SYNONYMS[name] || []
        for (const syn of syns) {
            if (input.includes(syn)) score += 60
        }
    }

    return score
}

// ─── TOP 3 MATCHES ────────────────────────────────────────────
function getTopMatches(itemName: string, foods: any[]) {
    const scored = foods.map(food => ({
        food,
        score: scoreFood(itemName, food)
    }))

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
}

// ─── PROMPT ───────────────────────────────────────────────────
const PROMPT = `
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

// ─── ROUTE POST ───────────────────────────────────────────────
export async function POST(req: Request) {

    console.log("🔑 KEY EXISTS:", !!process.env.ANTHROPIC_API_KEY)
    console.log("🔑 KEY LENGTH:", process.env.ANTHROPIC_API_KEY?.length)

    // Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (!user || error) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    // ─── VÉRIFICATION ABONNEMENT ──────────────────────────────
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('user_id', user.id)
        .single()
    
    let tier = profile?.subscription_tier || 'free'
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
    
    // Si l'abonnement est expiré, on force le mode free
    if (expiresAt && expiresAt < new Date()) {
        tier = 'free'
    }

    if (tier === 'free') {
        const today = new Date().toISOString().split('T')[0]
        const { count, error: countError } = await supabase
            .from('meals')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('logged_at', `${today}T00:00:00.000Z`)
            .lte('logged_at', `${today}T23:59:59.999Z`)
            .gt('ai_confidence', 0)

        // Limite passée à 2 scans gratuits par jour
        if (count !== null && count >= 2) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: "Limite de scan atteinte (2/jour en mode gratuit)", 
                code: "LIMIT_REACHED" 
            }), { status: 403 })
        }
    }

    // ─── MODE SIMULATION (POUR ÉCONOMISER LES TOKENS EN TEST) ───
    const MOCK_MODE = true 

    if (MOCK_MODE) {
        console.log("🛠️ MOCK MODE: Simulation d'un scan (Garba Royal)")
        const mockResult: ScanResultV2 = {
            meal_name: "Garba Royal (Attiéké & Thon)",
            total_calories: 880,
            components: [
                { food_name: "attieke", estimated_portion_g: 300, calories: 560, protein_g: 4, carbs_g: 130, fat_g: 2, confidence: 95 },
                { food_name: "thon", estimated_portion_g: 100, calories: 190, protein_g: 25, carbs_g: 0, fat_g: 10, confidence: 95 },
                { food_name: "huile", estimated_portion_g: 15, calories: 130, protein_g: 0, carbs_g: 0, fat_g: 14, confidence: 90 }
            ],
            alternatives: []
        }

        // Simuler le reste de la logique avec le mockResult
        const components = mockResult.components
        const { data: foodItems } = await supabase
            .from("food_items")
            .select("id, name_fr, name_local, name_en, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
        
        const results = []
        for (const component of components) {
            const topMatches = getTopMatches(component.food_name, foodItems || [])
            results.push({
                detected: component.food_name,
                portion_g: component.estimated_portion_g,
                calories_detected: component.calories,
                protein_detected: component.protein_g,
                carbs_detected: component.carbs_g,
                fat_detected: component.fat_g,
                confidence: component.confidence,
                suggestions: topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.name_fr || m.food.name_local || m.food.name_en,
                    score: m.score,
                    calories: Math.round((m.food.calories_per_100g * component.estimated_portion_g) / 100),
                    protein_g: Math.round((m.food.protein_per_100g * component.estimated_portion_g) / 100 * 10) / 10,
                    carbs_g: Math.round((m.food.carbs_per_100g * component.estimated_portion_g) / 100 * 10) / 10,
                    fat_g: Math.round((m.food.fat_per_100g * component.estimated_portion_g) / 100 * 10) / 10
                }))
            })
        }

        return NextResponse.json({
            success: true,
            meal_name: mockResult.meal_name,
            total_calories: mockResult.total_calories,
            data: results
        })
    }

    try {
        const { images } = await req.json()
        const image = images?.[0]

        if (!image || !image.data) {
            console.error("❌ IMAGE INVALID:", image)
            return NextResponse.json({ success: false, error: "Image invalide ou vide" })
        }

        console.log("📸 TYPE:", image.mimeType)
        console.log("📸 BASE64 SIZE:", image.data.length)

        // ─── APPEL IA ─────────────────────────────────────────
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: image.mimeType || "image/jpeg",
                                data: image.data,
                            },
                        },
                        {
                            type: "text",
                            text: PROMPT,
                        },
                    ],
                },
            ],
        })

        console.log("🔥 RAW RESPONSE:", JSON.stringify(response.content))

        // ─── PARSE JSON ───────────────────────────────────────
        let scanResult: ScanResultV2 | null = null

        try {
            const textBlock = response.content.find(
                (block) => block.type === "text" && "text" in block
            ) as { type: "text"; text: string } | undefined

            if (!textBlock) throw new Error("Aucun texte retourné par l'IA")

            const text = textBlock.text
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim()

            scanResult = JSON.parse(text) as ScanResultV2

        } catch (err) {
            console.error("❌ JSON Claude invalide:", err)
        }

        // ─── FALLBACK si l'IA échoue ──────────────────────────
        const components: ScanComponent[] = scanResult?.components?.length
            ? scanResult.components
            : [
                { food_name: "riz", estimated_portion_g: 200, calories: 260, protein_g: 5, carbs_g: 57, fat_g: 0.5, confidence: 50 },
                { food_name: "poulet", estimated_portion_g: 150, calories: 248, protein_g: 30, carbs_g: 0, fat_g: 14, confidence: 50 }
            ]

        // ─── MATCHING BD ──────────────────────────────────────
        const { data: foodItems } = await supabase
            .from("food_items")
            .select("id, name_fr, name_local, name_en, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")

        const results = []

        for (const component of components) {
            const topMatches = getTopMatches(component.food_name, foodItems || [])
            const portion = component.estimated_portion_g

            results.push({
                detected: component.food_name,
                portion_g: portion,
                // ✅ Valeurs calculées par l'IA pour cette portion spécifique
                calories_detected: component.calories,
                protein_detected: component.protein_g,
                carbs_detected: component.carbs_g,
                fat_detected: component.fat_g,
                confidence: component.confidence,
                // ✅ Suggestions depuis ta BD avec calories recalculées pour la même portion
                suggestions: topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.name_fr,
                    score: m.score,
                    calories: Math.round((m.food.calories_per_100g * portion) / 100),
                    protein_g: Math.round((m.food.protein_per_100g * portion) / 100 * 10) / 10,
                    carbs_g: Math.round((m.food.carbs_per_100g * portion) / 100 * 10) / 10,
                    fat_g: Math.round((m.food.fat_per_100g * portion) / 100 * 10) / 10,
                }))
            })
        }

        const totalCalories = scanResult?.total_calories
            || components.reduce((sum, c) => sum + c.calories, 0)

        console.log("✅ RESULTS:", JSON.stringify(results))

        return NextResponse.json({
            success: true,
            meal_name: scanResult?.meal_name || "Repas détecté",
            total_calories: totalCalories,
            data: results
        } satisfies ScanApiResponse)

    } catch (err: any) {
        console.error("❌ ERROR:", err)
        return NextResponse.json({
            success: false,
            meal_name: "",
            total_calories: 0,
            data: [],
            error: err?.message || "Erreur serveur",
        } satisfies ScanApiResponse)
    }
}