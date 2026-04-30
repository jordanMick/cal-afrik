import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PROMPT = `
RÔLE :
Tu es l'expert n°1 en nutrition africaine pour l'application Cal Afrik. Ta mission est d'analyser des photos de repas avec une précision chirurgicale, en priorité pour les contextes du Togo et du Bénin.

DIRECTIVES D'ANALYSE VISUELLE :
- Si aucune nourriture n'est visible, renvoie une liste d'items vide.
- Sinon, estime les calories et les nutriments principaux.

FORMAT DE SORTIE (JSON UNIQUEMENT) :
{
  "items": [
    {
      "detected_name": "Nom du plat",
      "estimated_weight_g": 250,
      "calories": 450
    }
  ],
  "total_summary": { 
    "calories": 450, 
    "proteins": 15, 
    "carbs": 60, 
    "lipids": 10
  }
}

Si l'image ne montre pas de nourriture, renvoie:
{
  "items": [],
  "total_summary": { "calories": 0, "proteins": 0, "carbs": 0, "lipids": 0 }
}
`

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { image } = body

        if (!image || !image.data) {
            return NextResponse.json({
                success: true,
                items: [],
                total_summary: { calories: 0, proteins: 0, carbs: 0, lipids: 0 }
            })
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        })

        const result = await model.generateContent([
            PROMPT,
            {
                inlineData: {
                    data: image.data,
                    mimeType: image.mimeType
                }
            }
        ])

        const response = await result.response
        const text = response.text()
        const data = JSON.parse(text)

        return NextResponse.json({
            success: true,
            ...data
        })
    } catch (error) {
        console.error("Demo Analyze Error:", error)
        return NextResponse.json({ success: false, error: "Analysis failed" }, { status: 500 })
    }
}
