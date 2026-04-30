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

const GEMINI_MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
]

export async function POST(req: Request) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured")
        }

        const body = await req.json()
        const { image } = body

        if (!image || !image.data) {
            return NextResponse.json({
                success: true,
                items: [],
                total_summary: { calories: 0, proteins: 0, carbs: 0, lipids: 0 }
            })
        }

        let lastError = null
        let result = null

        // Boucle sur les modèles candidats
        for (const modelName of GEMINI_MODEL_CANDIDATES) {
            try {
                console.log(`Tentative avec le modèle : ${modelName}`)
                const model = genAI.getGenerativeModel({ model: modelName })
                result = await model.generateContent([
                    PROMPT,
                    {
                        inlineData: {
                            data: image.data,
                            mimeType: image.mimeType || "image/jpeg"
                        }
                    }
                ])
                if (result) break // Succès !
            } catch (err: any) {
                console.error(`Échec avec ${modelName}:`, err.message)
                lastError = err
            }
        }

        if (!result) {
            throw lastError || new Error("Aucun modèle n'a pu répondre")
        }

        const response = await result.response

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("L'IA n'a pas pu générer de réponse pour cette image. (Sécurité ou Qualité)")
        }

        const text = response.text()
        console.log("Gemini Raw Response:", text)

        let data;
        try {
            const cleanedText = text.replace(/```json|```/g, "").trim()
            data = JSON.parse(cleanedText)
        } catch (e) {
            console.error("JSON Parse Error:", e, "Text:", text)
            throw new Error("Format de réponse IA invalide")
        }

        return NextResponse.json({
            success: true,
            ...data
        })
    } catch (error: any) {
        console.error("Demo Analyze Error Details:", error)
        return NextResponse.json({
            success: false,
            error: error.message || "Erreur lors de l'analyse"
        }, { status: 500 })
    }
}
