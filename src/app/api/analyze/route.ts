import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 🔥 NORMALIZE
function normalize(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
}

// 🔥 SCORE
function scoreFood(itemName: string, food: any) {
    const input = normalize(itemName)

    const names = [
        food.name_fr,
        food.name_local,
        food.name_en
    ].filter(Boolean).map(normalize)

    let score = 0

    for (const name of names) {
        if (input.includes(name)) score += 50
        if (name.includes(input)) score += 30

        const inputWords = input.split(" ")
        const nameWords = name.split(" ")

        for (const word of inputWords) {
            if (nameWords.includes(word)) score += 10
        }
    }

    return score
}

// 🔥 TOP 3 MATCHES
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

// 🔥 PROMPT
const PROMPT = `
Analyse ce plat africain.

Retourne UNIQUEMENT un JSON :
[
  { "name": "riz", "portion_g": 200 }
]
`

export async function POST(req: Request) {

    console.log("🔑 KEY EXISTS:", !!process.env.ANTHROPIC_API_KEY)
    console.log("🔑 KEY LENGTH:", process.env.ANTHROPIC_API_KEY?.length)

    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (!user || error) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    try {
        const { images } = await req.json()

        const image = images?.[0]

        // 🔥 VALIDATION ULTRA IMPORTANTE
        if (!image || !image.data) {
            console.error("❌ IMAGE INVALID:", image)
            return NextResponse.json({
                success: false,
                error: "Image invalide ou vide"
            })
        }

        console.log("📸 IMAGE TYPE:", image.mimeType)
        console.log("📸 IMAGE SIZE:", image.data.length)

        // 🔥 IA
        const response = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 300,
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

        let items: any[] = []

        try {
            const textBlock = response.content.find(
                (block) => block.type === "text" && "text" in block
            )

            if (!textBlock) {
                throw new Error("Aucun texte retourné")
            }

            const text = textBlock.text
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim()

            items = JSON.parse(text)

        } catch (err) {
            console.error("❌ JSON Claude invalide:", err)
            items = []
        }

        // 🔥 fallback
        if (!items.length) {
            items = [
                { name: "riz", portion_g: 200 },
                { name: "poulet", portion_g: 150 }
            ]
        }

        // 🔥 DB
        const { data: foodItems } = await supabase
            .from("food_items")
            .select("id, name_fr, name_local, name_en, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")

        const results = []

        for (const item of items) {
            const topMatches = getTopMatches(item.name, foodItems || [])

            results.push({
                detected: item.name,
                portion_g: item.portion_g,
                suggestions: topMatches.map(m => ({
                    id: m.food.id,
                    name: m.food.name_fr,
                    score: m.score,
                    calories_per_100g: m.food.calories_per_100g,
                    protein_per_100g: m.food.protein_per_100g,
                    carbs_per_100g: m.food.carbs_per_100g,
                    fat_per_100g: m.food.fat_per_100g,
                }))
            })
        }

        return NextResponse.json({
            success: true,
            data: results
        })

    } catch (err: any) {
        console.error("❌ ERROR:", err)

        return NextResponse.json({
            success: false,
            error: err?.message || "Erreur serveur",
        })
    }
}