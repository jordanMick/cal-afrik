import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ScanResultV2, ScanApiResponse } from "@/types"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après, contenant les champs suivants :
{
  "plat_nom": "nom du repas complet",
  "items": [
    { "label": "Nom de l'aliment", "volume_ml": nombre }
  ],
  "coach_advice": "conseil bref du coach (max 2 phrases)"
}
Assure-toi que le champ coach_advice est présent ; s'il manque, utilise le texte de secours fourni.
`


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
        .select('subscription_tier, subscription_expires_at, scan_feedbacks_today')
        .eq('user_id', user.id)
        .single()

    let tier = profile?.subscription_tier || 'free'
    const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null

    // Si l'abonnement est expiré, on force le mode free
    if (expiresAt && expiresAt < new Date()) {
        tier = 'free'
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

    // ─── MODE SIMULATION (POUR ÉCONOMISER LES TOKENS EN TEST) ───
    const MOCK_MODE = false

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

        // ✅ Décompte du jeton pour les gratuits
        if (tier === 'free') {
            await supabase.rpc('increment_scan_feedback', { user_id_input: user.id })
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

        // ─── APPEL IA (Gemini) ───────────────────────────────────────
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.7,
                maxOutputTokens: 800,
            },
            systemInstruction: `Expert en nutrition d'Afrique de l'Ouest. Doit identifier les composants du plat avec leurs noms locaux. Doit estimer les volumes en ml (millilitres). Doit donner un conseil de coach court (2 phrases max).`,
        });
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: image.mimeType || "image/jpeg",
                    data: image.data,
                },
            },
            { text: PROMPT },
        ]);
        const responseText = await result.response.text();

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
        }

        if (!geminiResult || !Array.isArray(geminiResult.items)) {
            return NextResponse.json({
                success: false,
                meal_name: "",
                total_calories: 0,
                data: [],
                error: "Réponse Gemini invalide",
            }, { status: 422 })
        }

        // ─── MATCHING BD ──────────────────────────────────────
        const { data: foodItems } = await supabase
            .from("food_items")
            .select("id, name_fr, name_local, name_en, density_g_ml, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
        const { data: foodAliases } = await supabase
            .from("food_aliases")
            .select("alias, food_item_id")

        const foodsById = new Map((foodItems || []).map((food: any) => [food.id, food]))
        const aliasToFood = new Map<string, any>()
        for (const aliasRow of foodAliases || []) {
            const food = foodsById.get((aliasRow as any).food_item_id)
            const alias = (aliasRow as any).alias
            if (food && alias) {
                aliasToFood.set(normalize(String(alias)), food)
            }
        }

        const results: any[] = []
        let totalCalories = 0

        for (const component of geminiResult.items) {
            const label = String(component?.label || "aliment inconnu")
            const volumeMl = Number(component?.volume_ml || 0)
            if (!Number.isFinite(volumeMl) || volumeMl <= 0) {
                continue
            }
            const normalizedLabel = normalize(label)
            const { data: aliasMatchRows } = await supabase
                .from("food_aliases")
                .select(`
                    alias,
                    food_item_id,
                    food_items (
                        id,
                        name_fr,
                        name_local,
                        name_en,
                        density_g_ml,
                        calories_per_100g,
                        protein_per_100g,
                        carbs_per_100g,
                        fat_per_100g
                    )
                `)
                .ilike("alias", label)
                .limit(1)

            const matchedByAlias = Array.isArray(aliasMatchRows) && aliasMatchRows.length > 0
                ? (aliasMatchRows[0] as any).food_items
                : null

            const matchedFood = matchedByAlias
                || aliasToFood.get(normalizedLabel)
                || (foodItems || []).find((food: any) => {
                    const names = [food.name_fr, food.name_local, food.name_en].filter(Boolean)
                    return names.some((name: string) => normalize(name) === normalizedLabel)
                })
            const topMatches = getTopMatches(label, foodItems || [])
            const density = Number(matchedFood?.density_g_ml ?? 1.0)
            const weight = volumeMl * (Number.isFinite(density) ? density : 1.0)

            const caloriesDetected = Math.round(((Number(matchedFood?.calories_per_100g) || 0) * weight) / 100)
            const proteinDetected = Math.round((((Number(matchedFood?.protein_per_100g) || 0) * weight) / 100) * 10) / 10
            const carbsDetected = Math.round((((Number(matchedFood?.carbs_per_100g) || 0) * weight) / 100) * 10) / 10
            const fatDetected = Math.round((((Number(matchedFood?.fat_per_100g) || 0) * weight) / 100) * 10) / 10
            totalCalories += caloriesDetected

            results.push({
                detected: label,
                portion_g: Math.round(weight),
                calories_detected: caloriesDetected,
                protein_detected: proteinDetected,
                carbs_detected: carbsDetected,
                fat_detected: fatDetected,
                confidence: Number(component?.confidence || 80),
                suggestions: topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.name_fr || m.food.name_local || m.food.name_en,
                    score: m.score,
                    calories: Math.round(((Number(m.food.calories_per_100g) || 0) * weight) / 100),
                    protein_g: Math.round((((Number(m.food.protein_per_100g) || 0) * weight) / 100) * 10) / 10,
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