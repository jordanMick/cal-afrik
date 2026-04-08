import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenAI } from "@google/genai"
import type { ScanApiResponse } from "@/types"

const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY as string,
    apiVersion: "v1",
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── NORMALIZE ────────────────────────────────────────────────
function normalize(text?: string | null) {
    return text
        ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        : ""
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
        food.name_standard,
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

Analyse la photo et DÉCOMPOSE chaque aliment visible séparément avec son poids et ses macronutriments.

IMPORTANT :
- Identifie EXACTEMENT les aliments visibles UNIQUEMENT avec ton intelligence visuelle (image), sans te baser sur une base d'alias.
- Priorité absolue à la vision: la couleur, la texture, la forme et la consistance priment sur les suppositions de nom.
- Exemple de règle: si la pâte est rouge/tomate, ne la confonds pas avec une pâte blanche type Akoumé.
- Sépare l'accompagnement (tô, riz, fufu...) de la sauce ou du plat principal
- Donne une estimation de poids en grammes pour chaque composant
- Calcule calories, protéines, glucides et lipides pour chaque composant
- Si incertain, utilise le nom le plus générique et descriptif possible (ex: "Pâte de maïs à la tomate") au lieu d'un nom local potentiellement faux.
- Ne bloque jamais la réponse: en cas d'hésitation, réponds avec des noms génériques fiables et des estimations prudentes.

"Protocole de Mesure Spatiale :"

Priorité aux Objets Témoins : Si tu vois une pièce de monnaie, un téléphone ou un couvert, utilise-les pour estimer le diamètre de l'assiette.

Estimation par Volume : Ne te contente pas de la surface. Calcule mentalement l'épaisseur (la hauteur) de la pâte. Une boule de pâte de 300g fait environ la taille d'un gros poing fermé.

Vérification de Cohérence : Si ton calcul arrive à plus de 500g pour une seule portion de pâte ou plus de 400g de viande, revérifie ton échelle. Est-ce une assiette géante ou es-tu trop près ?

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après, contenant les champs suivants :
{
  "items": [
    {
      "name": "Nom de l'aliment",
      "weight_g": 200,
      "calories": 240,
      "proteins": 5.2,
      "carbs": 45.0,
      "lipids": 1.5
    }
  ],
  "total_summary": {
    "calories": 240,
    "proteins": 5.2,
    "carbs": 45.0,
    "lipids": 1.5
  },
  "coach_advice": "conseil bref du coach (max 2 phrases)"
}
Assure-toi que le champ coach_advice est présent ; s'il manque, utilise le texte de secours fourni.
`
function buildPrompt(country?: string | null) {
    const countryContext = (country || "").trim() || "Afrique de l'Ouest"
    return `${PROMPT}

Contexte géographique prioritaire: ${countryContext}.
Utilise ce contexte pour choisir le nom local le plus probable, mais seulement s'il est cohérent avec les indices visuels observés.`
}

const GEMINI_MODEL_CANDIDATES = [
    "gemini-2.5-flash",
]
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))


// ─── ROUTE POST ───────────────────────────────────────────────
export async function POST(req: Request) {

    // Gemini API key is accessed via process.env.GEMINI_API_KEY

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
        .select('subscription_tier, subscription_expires_at, scan_feedbacks_today, country')
        .eq('user_id', user.id)
        .single()

    let tier = profile?.subscription_tier || 'free'
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null

    // Si l'abonnement est expiré, on force le mode free
    if (expiresAt && expiresAt < new Date()) {
        tier = 'free'
        if (profile?.subscription_tier && profile.subscription_tier !== 'free') {
            await supabase
                .from('user_profiles')
                .update({ subscription_tier: 'free' })
                .eq('user_id', user.id)
        }
    }

    if (tier === 'free') {
        const actionsUsed = (profile?.scan_feedbacks_today || 0)

        // Limite de 2 actions (Scan + Suggestions) par jour en mode gratuit
        if (actionsUsed >= 2) {
            return new Response(JSON.stringify({
                success: false,
                error: "Limite d'actions gratuite atteinte (2/jour). Passez au plan Pro !",
                code: "LIMIT_REACHED"
            }), { status: 403 })
        }
    }

    const MOCK_MODE = true
    if (MOCK_MODE) {
        const mockData = [
            {
                detected: "Pâte de maïs",
                portion_g: 250,
                calories_detected: 410,
                protein_detected: 4.0,
                carbs_detected: 90.0,
                fat_detected: 1.2,
                confidence: 92,
                suggestions: [],
            },
            {
                detected: "Sauce légumes",
                portion_g: 220,
                calories_detected: 260,
                protein_detected: 8.5,
                carbs_detected: 20.0,
                fat_detected: 14.0,
                confidence: 88,
                suggestions: [],
            }
        ]

        if (tier === 'free') {
            await supabase.rpc('increment_scan_feedback', { user_id_input: user.id })
        }

        return NextResponse.json({
            success: true,
            meal_name: "Repas détecté (MOCK)",
            total_calories: mockData.reduce((sum, it) => sum + it.calories_detected, 0),
            data: mockData,
            coach_message: "Mode test: bon équilibre global, ajuste la portion selon ton objectif.",
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

        // ─── APPEL IA (Gemini) ───────────────────────────────────────
        const inputParts = [
            {
                inlineData: {
                    mimeType: image.mimeType || "image/jpeg",
                    data: image.data,
                },
            },
            { text: buildPrompt(profile?.country) },
        ]
        let responseText = ""
        let generationError: any = null
        let lastTriedModel = ""

        for (const modelName of GEMINI_MODEL_CANDIDATES) {
            lastTriedModel = modelName
            try {
                const maxAttempts = 3
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        const result = await genAI.models.generateContent({
                            model: modelName,
                            contents: inputParts as any,
                        })
                        responseText = typeof (result as any).text === "function"
                            ? (result as any).text()
                            : String((result as any).text || "")
                        generationError = null
                        console.log(`✅ Gemini modèle utilisé: ${modelName} (attempt ${attempt}/${maxAttempts})`)
                        break
                    } catch (err: any) {
                        const rawErr = String(err?.message || "")
                        const isUnavailable =
                            err?.status === 503
                            || rawErr.includes("UNAVAILABLE")
                            || rawErr.toLowerCase().includes("high demand")
                        generationError = err
                        console.error(err)
                        console.error(`❌ Gemini tentative ${attempt}/${maxAttempts} échouée avec ${modelName}`)
                        if (!isUnavailable || attempt === maxAttempts) break
                        await wait(800 * attempt)
                    }
                }
                if (!generationError) break
            } catch (err: any) {
                generationError = err
                console.error(err)
                console.error(`❌ Gemini generateContent échoue avec ${modelName}`)
            }
        }

        if (generationError) {
            const rawError = generationError?.message || "Gemini generateContent error"
            const isQuotaExceeded =
                generationError?.status === 429
                || String(rawError).includes("RESOURCE_EXHAUSTED")
                || String(rawError).toLowerCase().includes("quota")
            const isTemporarilyUnavailable =
                generationError?.status === 503
                || String(rawError).includes("UNAVAILABLE")
                || String(rawError).toLowerCase().includes("high demand")

            if (isQuotaExceeded) {
                return NextResponse.json({
                    success: false,
                    meal_name: "",
                    total_calories: 0,
                    data: [],
                    code: "GEMINI_QUOTA_EXCEEDED",
                    error: `Quota Gemini dépassé sur ${lastTriedModel}. Vérifie ton plan/facturation Google AI Studio ou réessaie plus tard.`,
                    raw_error: rawError,
                }, { status: 429 })
            }
            if (isTemporarilyUnavailable) {
                return NextResponse.json({
                    success: false,
                    meal_name: "",
                    total_calories: 0,
                    data: [],
                    code: "GEMINI_TEMP_UNAVAILABLE",
                    error: `Gemini temporairement indisponible sur ${lastTriedModel}. Réessaie dans quelques secondes.`,
                    raw_error: rawError,
                }, { status: 503 })
            }

            return NextResponse.json({
                success: false,
                meal_name: "",
                total_calories: 0,
                data: [],
                error: rawError,
            }, { status: 502 })
        }

        console.log("🔥 RAW RESPONSE:", responseText)

        // ─── PARSE JSON ───────────────────────────────────────
        // Parse Gemini JSON response
        let geminiResult: any = null;
        try {
            const cleaned = responseText
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();
            geminiResult = JSON.parse(cleaned);
        } catch (err) {
            console.error("❌ JSON Gemini invalide:", err);
            return NextResponse.json({
                success: false,
                meal_name: "",
                total_calories: 0,
                data: [],
                error: `Gemini JSON invalide: ${responseText}`,
            }, { status: 422 })
        }
        console.log("Gemini a détecté :", geminiResult)

        if (!geminiResult || !Array.isArray(geminiResult.items)) {
            return NextResponse.json({
                success: false,
                meal_name: "",
                total_calories: 0,
                data: [],
                error: `Réponse Gemini invalide: ${responseText}`,
            }, { status: 422 })
        }

        // ─── MATCHING BD ──────────────────────────────────────
        const { data: foodItems } = await supabase
            .from("food_items")
            .select("id, name_standard, name_en, density_g_ml, calories_per_100g, proteins_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
        const { data: foodAliases } = await supabase
            .from("food_aliases")
            .select("alias_name, food_item_id")

        const foodsById = new Map((foodItems || []).map((food: any) => [food.id, food]))
        const aliasToFood = new Map<string, any>()
        for (const aliasRow of foodAliases || []) {
            const food = foodsById.get((aliasRow as any).food_item_id)
            const alias = (aliasRow as any).alias_name
            if (food && alias) {
                aliasToFood.set(normalize(String(alias)), food)
            }
        }

        const results: any[] = []
        let totalCalories = 0

        for (const component of geminiResult.items) {
            const itemName = String(component?.name || component?.label || "aliment inconnu")
            const aiWeight = Number(component?.weight_g || 0)
            if (!Number.isFinite(aiWeight) || aiWeight <= 0) {
                continue
            }
            const normalizedLabel = normalize(itemName)
            // PRIORITE ABSOLUE SQL: LOWER(alias_name) = LOWER(nom_ia)
            const { data: sqlAliasMatchRows } = await supabase
                .from("food_aliases")
                .select(`
                    alias_name,
                    food_item_id,
                    food_items (
                        id,
                        name_standard,
                        name_en,
                        density_g_ml,
                        calories_per_100g,
                        proteins_100g,
                        protein_per_100g,
                        carbs_per_100g,
                        fat_per_100g
                    )
                `)
                .ilike("alias_name", itemName)
                .limit(1)
            const matchedByAliasSql = Array.isArray(sqlAliasMatchRows) && sqlAliasMatchRows.length > 0
                ? (sqlAliasMatchRows[0] as any).food_items
                : null
            console.log("Match trouvé en BD ?:", !!matchedByAliasSql)

            // Fallback normalisé si aucun match SQL exact sur alias_name
            const matchedByAlias = matchedByAliasSql || aliasToFood.get(normalizedLabel) || null
            const normalizedForLike = normalizedLabel.replace(/'/g, "''")
            let matchedByNameIlike: any = null
            if (!matchedByAlias && normalizedForLike) {
                const { data: fuzzyByName } = await supabase
                    .from("food_items")
                    .select("id, name_standard, name_en, density_g_ml, calories_per_100g, proteins_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
                    .or(`name_standard.ilike.%${itemName}%,name_standard.ilike.%${normalizedForLike}%`)
                    .limit(1)
                matchedByNameIlike = Array.isArray(fuzzyByName) && fuzzyByName.length > 0
                    ? fuzzyByName[0]
                    : null
            }

            const matchedFood = matchedByAlias
                || matchedByNameIlike
                || aliasToFood.get(normalizedLabel)
                || (foodItems || []).find((food: any) => {
                    const names = [food.name_standard, food.name_en].filter(Boolean)
                    return names.some((name: string) => normalize(name) === normalizedLabel)
                })
            console.log("🧪 FOOD ITEM MATCH:", matchedFood)
            const topMatches = getTopMatches(itemName, foodItems || [])
            const weight = aiWeight

            const caloriesDetected = matchedFood
                ? Math.round(((Number(matchedFood?.calories_per_100g) || 0) * weight) / 100)
                : Math.round(Number(component?.calories) || 0)
            const proteinsPer100g = Number(matchedFood?.proteins_100g ?? matchedFood?.protein_per_100g) || 0
            const proteinDetected = matchedFood
                ? Math.round(((proteinsPer100g * weight) / 100) * 10) / 10
                : Math.round((Number(component?.proteins) || 0) * 10) / 10
            const carbsDetected = matchedFood
                ? Math.round((((Number(matchedFood?.carbs_per_100g) || 0) * weight) / 100) * 10) / 10
                : Math.round((Number(component?.carbs) || 0) * 10) / 10
            const fatDetected = matchedFood
                ? Math.round((((Number(matchedFood?.fat_per_100g) || 0) * weight) / 100) * 10) / 10
                : Math.round((Number(component?.lipids) || 0) * 10) / 10
            totalCalories += caloriesDetected

            results.push({
                detected: itemName,
                portion_g: Math.round(weight),
                calories_detected: caloriesDetected,
                protein_detected: proteinDetected,
                carbs_detected: carbsDetected,
                fat_detected: fatDetected,
                confidence: Number(component?.confidence || 80),
                suggestions: topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.name_standard || m.food.name_en,
                    score: m.score,
                    calories: Math.round(((Number(m.food.calories_per_100g) || 0) * weight) / 100),
                    protein_g: Math.round(((((Number(m.food.proteins_100g ?? m.food.protein_per_100g) || 0) * weight) / 100) * 10)) / 10,
                    carbs_g: Math.round((((Number(m.food.carbs_per_100g) || 0) * weight) / 100) * 10) / 10,
                    fat_g: Math.round((((Number(m.food.fat_per_100g) || 0) * weight) / 100) * 10) / 10,
                }))
            })
        }

        console.log("✅ RESULTS:", JSON.stringify(results))

        // ✅ Décompte du jeton pour les gratuits
        if (tier === 'free') {
            await supabase.rpc('increment_scan_feedback', { user_id_input: user.id })
        }

        return NextResponse.json({
            success: true,
            meal_name: geminiResult.plat_nom || "Repas détecté",
            total_calories: totalCalories,
            data: results,
            coach_message: geminiResult.coach_advice || null
        })

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