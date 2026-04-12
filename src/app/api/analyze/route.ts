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

function normalizeTechnicalKey(text?: string | null) {
    return normalize(text)
        .replace(/\s+/g, "_")
        .replace(/-/g, "_")
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
        food.display_name
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
RÔLE :
Tu es l'expert n°1 en nutrition africaine pour l'application Cal-Afrik. Ta mission est d'analyser des photos de repas avec une précision chirurgicale, en priorité pour les contextes du Togo et du Bénin, tout en restant capable d'analyser des plats internationaux.

DIRECTIVES D'ANALYSE VISUELLE :
- Priorité absolue à la vision : la couleur, la texture et la consistance priment.
- Une pâte rouge/orange ne peut PAS être un Akple/Akpan ; c'est plutôt un profil de pâte assaisonnée.
- Décomposition systématique : sépare l'accompagnement (pâte, riz, fufu) de la sauce et des protéines (viande, poisson).
- PRIORITÉ NOM LOCAL: detected_name doit être formulé avec une appellation locale cohérente avec le pays fourni.

PROTOCOLE DE MESURE SPATIALE :
- Utilise les objets témoins (couverts, mains, bords de l'assiette) pour estimer l'échelle.
- Estimation par volume : une boule de pâte de 300g fait environ la taille d'un gros poing fermé.
- Cohérence : si une portion dépasse 500g, revérifie ton échelle.

CONTRAINTES SUPPLÉMENTAIRES :
- Si le plat n'est pas ouest-africain, utilise un nom neutre et technical_match = "unknown".
- Ne jamais inventer de profils techniques en dehors de la liste fournie.
- Si aucune nourriture n'est visible, renvoie une liste d'items vide et un conseil demandant une photo claire du repas.

FORMAT DE SORTIE (JSON UNIQUEMENT) :
Retourne exclusivement ce format, sans texte avant ou après :
{
  "items": [
    {
      "detected_name": "Nom local identifié",
      "technical_match": "nom_standard_issu_de_la_liste",
      "confidence": 0.95,
      "estimated_weight_g": 250,
      "fallback_data": {
        "calories_per_100g": 120,
        "proteins_100g": 2.5,
        "lipids_100g": 0.5,
        "carbs_100g": 28.0,
        "density_g_ml": 1.1
      }
    }
  ],
  "total_summary": { "calories": 0, "proteins": 0, "carbs": 0, "lipids": 0 }
}
Vérifie deux fois la structure syntaxique de ton JSON. Chaque objet dans "items" doit être parfaitement fermé par une virgule ou un crochet.
Si aucune image n'est fournie, si l'image est illisible, ou si l'image ne montre pas de nourriture, renvoie:
{
  "items": [],
  "total_summary": { "calories": 0, "proteins": 0, "carbs": 0, "lipids": 0 }
}

ERREUR DE POIDS CRITIQUE :
- Une portion normale de pâte pèse entre 250g et 400g.
- Une portion de viande/poulet dans une assiette pèse entre 150g et 250g.
- Si tes estimations dépassent ces valeurs, réduis-les fortement (divise par 2 ou 3), car tu surestimes probablement la profondeur de l'assiette.
`
const TECHNICAL_MATCH_ALLOWED = [
    "pate_mais_fermente",
    "pate_mais_non_fermente",
    "pate_mais_assaisonnee",
    "pate_igname_pilee",
    "pate_mil_sorgho",
    "pate_manioc_fermente",
    "semoule_manioc_vapeur",
    "riz_blanc_vapeur",
    "riz_gras_jollof",
    "riz_legumineuse_mix",
    "pain_mais_vapeur",
    "igname_bouillie",
    "manioc_bouilli",
    "patate_douce_bouillie",
    "sauce_gluante_legere",
    "sauce_feuille_grasse",
    "sauce_noix_palme_dense",
    "sauce_noix_palme_claire",
    "sauce_arachide_pate",
    "sauce_legumes_claire",
    "sauce_tomate_friture",
    "sauce_piment_frais",
    "viande_rouge_braisee",
    "viande_rouge_frite",
    "volaille_braisee",
    "volaille_frite",
    "poisson_frit",
    "poisson_fume",
    "oeuf_bouilli",
    "oeuf_frit",
    "fromage_traditionnel_frit",
    "puree_legumineuse_vapeur",
    "beignet_farine_sucre",
    "beignet_legumineuse_frit",
    "snack_arachide_pate",
    "banane_plantain_frite",
    "unknown",
]

function buildPrompt(country?: string | null) {
    const countryContext = (country || "").trim() || "Afrique de l'Ouest"
    const profileList = TECHNICAL_MATCH_ALLOWED.join(", ")
    return `${PROMPT}

Contexte géographique prioritaire: ${countryContext}.
Utilise ce contexte pour choisir le nom local le plus probable, mais seulement s'il est cohérent avec les indices visuels observés.
Règle stricte: detected_name doit refléter le vocabulaire local de ce pays en priorité.

Liste des technical_match autorisés (utilise uniquement ces identifiants) :
${profileList}`
}

const GEMINI_MODEL_CANDIDATES = [
    // "gemini-2.5-flash",
    "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
]
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))


// ─── ROUTE POST ───────────────────────────────────────────────
export async function POST(req: Request) {
    console.log("=== [ANALYZE] START ===")

    // Gemini API key is accessed via process.env.GEMINI_API_KEY

    // Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
        console.log("[ANALYZE] Missing Authorization header")
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (!user || error) {
        console.log("[ANALYZE] Unauthorized user from token")
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
            console.log("[ANALYZE] Free limit reached", { userId: user.id, actionsUsed })
            return new Response(JSON.stringify({
                success: false,
                error: "Limite d'actions gratuite atteinte (2/jour). Passez au plan Pro !",
                code: "LIMIT_REACHED"
            }), { status: 403 })
        }
    }

    const MOCK_MODE = false
    if (MOCK_MODE) {
        console.log("[ANALYZE] MOCK MODE ACTIVE - no Gemini call")
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
        })
    }

    try {
        const { images } = await req.json()
        const image = images?.[0]
        console.log("[ANALYZE] Request payload received", {
            userId: user.id,
            hasImages: Array.isArray(images),
            imageCount: Array.isArray(images) ? images.length : 0,
        })

        if (!image || !image.data) {
            console.error("❌ IMAGE INVALID:", image)
            return NextResponse.json({
                success: true,
                meal_name: "Aucun aliment détecté",
                total_calories: 0,
                data: [],
                coach_message: "Aucune image exploitable n'a été reçue. Prends une photo plus claire de ton repas.",
            })
        }

        console.log("📸 TYPE:", image.mimeType)
        console.log("📸 BASE64 SIZE:", image.data.length)

        // Préchargement SQL: source de vérité nutritionnelle
        const { data: foodItems, error: foodItemsError } = await supabase
            .from("food_items")
            .select("id, name_standard, display_name, density_g_ml, calories_per_100g, proteins_100g, lipids_100g, carbs_100g")
        const { data: foodAliases, error: foodAliasesError } = await supabase
            .from("food_aliases")
            .select("alias_name, food_item_id")
        console.log("[ANALYZE] SQL preload", {
            foodItems: (foodItems || []).length,
            foodAliases: (foodAliases || []).length,
            foodItemsError: foodItemsError?.message || null,
            foodAliasesError: foodAliasesError?.message || null,
        })
        if (foodItemsError || foodAliasesError) {
            return NextResponse.json({
                success: false,
                meal_name: "",
                total_calories: 0,
                data: [],
                error: `SQL preload failed: ${foodItemsError?.message || foodAliasesError?.message}`,
            }, { status: 500 })
        }

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
            console.log("[ANALYZE] Trying Gemini model", modelName)
            try {
                const maxAttempts = 3
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        console.log("[ANALYZE] Gemini attempt", { modelName, attempt, maxAttempts })
                        const result = await genAI.models.generateContent({
                            model: modelName,
                            contents: inputParts as any,
                            config: {
                                temperature: 0.2,
                            },
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
        console.log("[ANALYZE] Gemini items count", Array.isArray(geminiResult?.items) ? geminiResult.items.length : 0)

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
            const detectedName = String(component?.detected_name || component?.name || component?.label || "aliment inconnu")
            const technicalMatch = String(component?.technical_match || "").trim()
            const fallbackData = component?.fallback_data || {}
            const aiWeight = Number(component?.estimated_weight_g || component?.weight_g || 0)
            console.log("[ANALYZE] Component incoming", {
                detectedName,
                technicalMatch,
                aiWeight,
                confidence: component?.confidence,
            })
            if (!Number.isFinite(aiWeight) || aiWeight <= 0) {
                console.log("[ANALYZE] Skip component due to invalid weight", { detectedName, aiWeight })
                continue
            }
            const normalizedLabel = normalize(detectedName)

            // 1) Recherche Alias
            const { data: sqlAliasMatchRows } = await supabase
                .from("food_aliases")
                .select(`
                    alias_name,
                    food_item_id,
                    food_items (
                        id,
                        name_standard,
                        display_name,
                        density_g_ml,
                        calories_per_100g,
                        proteins_100g,
                        lipids_100g,
                        carbs_100g
                    )
                `)
                .ilike("alias_name", detectedName)
                .limit(1)
            const matchedByAliasSql = Array.isArray(sqlAliasMatchRows) && sqlAliasMatchRows.length > 0
                ? (sqlAliasMatchRows[0] as any).food_items
                : null
            console.log("[ANALYZE][PIPELINE] alias_lookup", {
                detectedName,
                matched: !!matchedByAliasSql,
                matchedName: matchedByAliasSql?.display_name || matchedByAliasSql?.name_standard || null,
            })

            // 2) Recherche unknown_logs
            let unknownLogMatch: any = null
            if (!matchedByAliasSql) {
                const { data: unknownRows } = await supabase
                    .from("unknown_logs")
                    .select("*")
                    .ilike("detected_name", detectedName)
                    .limit(1)
                unknownLogMatch = Array.isArray(unknownRows) && unknownRows.length > 0 ? unknownRows[0] : null
                console.log("[ANALYZE][PIPELINE] unknown_logs_lookup", {
                    detectedName,
                    matched: !!unknownLogMatch,
                    occurrenceCount: unknownLogMatch?.occurrence_count ?? null,
                })
            }

            // 3) Recherche standard via technical_match -> name_standard
            let matchedByTechnical: any = null
            if (!matchedByAliasSql && !unknownLogMatch && technicalMatch) {
                const normalizedTechnical = normalizeTechnicalKey(technicalMatch)
                matchedByTechnical = (foodItems || []).find((food: any) =>
                    normalizeTechnicalKey(food?.name_standard) === normalizedTechnical
                ) || null
                console.log("[ANALYZE][PIPELINE] technical_match_lookup", {
                    technicalMatch,
                    matched: !!matchedByTechnical,
                    matchedName: matchedByTechnical?.display_name || matchedByTechnical?.name_standard || null,
                })
            }

            const matchedByAlias = matchedByAliasSql || aliasToFood.get(normalizedLabel) || null
            // L'ordre demandé : Alias -> unknown_logs -> technical_match
            const matchedFood = matchedByAlias || unknownLogMatch || matchedByTechnical || null
            console.log("🧪 FOOD ITEM MATCH:", matchedFood)
            console.log("Match trouvé en BD ?:", !!matchedFood)
            const topMatches = getTopMatches(detectedName, foodItems || [])
            const weight = aiWeight

            const caloriesDetected = matchedFood
                ? Math.round(((Number(matchedFood?.calories_per_100g) || 0) * weight) / 100)
                : Math.round((Number(fallbackData?.calories_per_100g) || 0) * weight / 100)
            const proteinsPer100g = Number(matchedFood?.proteins_100g) || 0
            const proteinDetected = matchedFood
                ? Math.round(((proteinsPer100g * weight) / 100) * 10) / 10
                : Math.round(((Number(fallbackData?.proteins_100g) || 0) * weight / 100) * 10) / 10
            const carbsDetected = matchedFood
                ? Math.round((((Number(matchedFood?.carbs_100g) || 0) * weight) / 100) * 10) / 10
                : Math.round(((Number(fallbackData?.carbs_100g) || 0) * weight / 100) * 10) / 10
            const fatDetected = matchedFood
                ? Math.round((((Number(matchedFood?.lipids_100g) || 0) * weight) / 100) * 10) / 10
                : Math.round(((Number(fallbackData?.lipids_100g) || 0) * weight / 100) * 10) / 10
            totalCalories += caloriesDetected

            // 4) Fallback + auto-apprentissage si aucun match SQL
            if (!matchedFood) {
                console.log("[ANALYZE] FALLBACK MODE for component", {
                    detectedName,
                    technicalMatch,
                    fallbackData,
                })
                try {
                    const { data: existingUnknownRows } = await supabase
                        .from("unknown_logs")
                        .select("id, occurrence_count")
                        .ilike("detected_name", detectedName)
                        .limit(1)
                    const existingUnknown = Array.isArray(existingUnknownRows) && existingUnknownRows.length > 0
                        ? existingUnknownRows[0] as any
                        : null
                    if (existingUnknown?.id) {
                        await supabase
                            .from("unknown_logs")
                            .update({
                                calories_per_100g: Number(fallbackData?.calories_per_100g) || 0,
                                proteins_100g: Number(fallbackData?.proteins_100g) || 0,
                                lipids_100g: Number(fallbackData?.lipids_100g) || 0,
                                carbs_100g: Number(fallbackData?.carbs_100g) || 0,
                                density_g_ml: Number(fallbackData?.density_g_ml) || 1.0,
                                occurrence_count: Number(existingUnknown.occurrence_count || 0) + 1,
                                last_detected_at: new Date().toISOString()
                            })
                            .eq("id", existingUnknown.id)
                    } else {
                        await supabase
                            .from("unknown_logs")
                            .insert({
                                detected_name: detectedName,
                                calories_per_100g: Number(fallbackData?.calories_per_100g) || 0,
                                proteins_100g: Number(fallbackData?.proteins_100g) || 0,
                                lipids_100g: Number(fallbackData?.lipids_100g) || 0,
                                carbs_100g: Number(fallbackData?.carbs_100g) || 0,
                                density_g_ml: Number(fallbackData?.density_g_ml) || 1.0,
                                occurrence_count: 1,
                            })
                    }
                } catch (logErr) {
                    console.error("⚠️ unknown_logs upsert error:", logErr)
                }
            }
            console.log("[ANALYZE][PIPELINE] final_resolution", {
                detectedName,
                source: matchedByAlias ? "alias" : unknownLogMatch ? "unknown_logs" : matchedByTechnical ? "technical_match" : "fallback_data",
                shownName: matchedFood?.display_name || matchedFood?.detected_name || detectedName,
                weight,
                caloriesDetected,
            })

            const displayDetected = matchedFood
                ? (matchedFood?.display_name || matchedFood?.detected_name || detectedName)
                : detectedName
            const finalResolvedSuggestion = matchedFood
                ? [{
                    id: matchedFood.id,
                    name: matchedFood.display_name || matchedFood.detected_name || matchedFood.name_standard,
                    score: 100,
                    calories: Math.round(((Number(matchedFood?.calories_per_100g) || 0) * weight) / 100),
                    protein_g: Math.round((((Number(matchedFood?.proteins_100g) || 0) * weight) / 100) * 10) / 10,
                    carbs_g: Math.round((((Number(matchedFood?.carbs_100g) || 0) * weight) / 100) * 10) / 10,
                    fat_g: Math.round((((Number(matchedFood?.lipids_100g) || 0) * weight) / 100) * 10) / 10,
                }]
                : []

            results.push({
                detected: displayDetected,
                portion_g: Math.round(weight),
                calories_detected: caloriesDetected,
                protein_detected: proteinDetected,
                carbs_detected: carbsDetected,
                fat_detected: fatDetected,
                confidence: Number(component?.confidence || 80),
                suggestions: finalResolvedSuggestion.length > 0 ? finalResolvedSuggestion : topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.display_name || m.food.name_standard,
                    score: m.score,
                    calories: Math.round(((Number(m.food.calories_per_100g) || 0) * weight) / 100),
                    protein_g: Math.round(((((Number(m.food.proteins_100g) || 0) * weight) / 100) * 10)) / 10,
                    carbs_g: Math.round((((Number(m.food.carbs_100g) || 0) * weight) / 100) * 10) / 10,
                    fat_g: Math.round((((Number(m.food.lipids_100g) || 0) * weight) / 100) * 10) / 10,
                }))
            })
        }

        console.log("✅ RESULTS:", JSON.stringify(results))
        const candidateMealName = String(
            geminiResult?.meal_name ||
            geminiResult?.plat_nom ||
            geminiResult?.dish_name ||
            ''
        ).trim()
        const fallbackMealName = (() => {
            const unique = Array.from(new Set(
                (results || [])
                    .map((r: any) => String(r?.detected || '').trim())
                    .filter(Boolean)
            ))
            if (unique.length === 0) return "Repas détecté"
            if (unique.length === 1) return unique[0]

            // Fallback intelligent (scanner Gemini): reconstruire un nom de plat
            // à partir des composants détectés (base + accompagnement/protéine + sauce).
            const normalizeText = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const hasAny = (value: string, keywords: string[]) => keywords.some(k => value.includes(k))
            const tokens = unique.map(name => ({ raw: name, n: normalizeText(name) }))

            const baseKeywords = [
                "riz", "pate", "akoume", "akume", "akassa", "fufu", "igname", "manioc", "plantain",
                "patate", "semoule", "couscous", "mil", "mais", "fonio", "haricot", "lentille"
            ]
            const proteinKeywords = [
                "poulet", "poisson", "viande", "boeuf", "oeuf", "thon", "dinde", "mouton", "crevette"
            ]
            const sauceKeywords = ["sauce", "gombo", "arachide", "tomate", "piment", "legume", "feuille", "epinard"]

            const base = tokens.find(t => hasAny(t.n, baseKeywords))?.raw
            const protein = tokens.find(t => hasAny(t.n, proteinKeywords))?.raw
            const sauce = tokens.find(t => hasAny(t.n, sauceKeywords) && t.raw !== base && t.raw !== protein)?.raw

            if (base && protein && sauce) return `${base} + ${protein} + ${sauce}`
            if (base && protein) return `${base} + ${protein}`
            if (base && sauce) return `${base} + ${sauce}`
            if (protein && sauce) return `${protein} + ${sauce}`

            return `${unique[0]} + ${unique[1]}`
        })()
        const finalMealName = candidateMealName && candidateMealName.toLowerCase() !== 'repas détecté'
            ? candidateMealName
            : fallbackMealName

        console.log("[ANALYZE] Final response", {
            totalCalories,
            componentsReturned: results.length,
            mealName: finalMealName,
        })

        // ✅ Décompte du jeton pour les gratuits
        if (tier === 'free') {
            await supabase.rpc('increment_scan_feedback', { user_id_input: user.id })
        }

        return NextResponse.json({
            success: true,
            meal_name: finalMealName,
            total_calories: totalCalories,
            data: results,
        })

    } catch (err: any) {
        console.error("❌ ERROR:", err)
        console.log("=== [ANALYZE] END WITH ERROR ===")
        return NextResponse.json({
            success: false,
            meal_name: "",
            total_calories: 0,
            data: [],
            error: err?.message || "Erreur serveur",
        } satisfies ScanApiResponse)
    } finally {
        console.log("=== [ANALYZE] END ===")
    }
}