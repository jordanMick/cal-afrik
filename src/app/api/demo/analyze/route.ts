import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        // Simulation d'un délai d'analyse
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Retourne un résultat simulé (Mock) pour éviter les erreurs d'API sur la landing page
        return NextResponse.json({
            success: true,
            mock: true,
            items: [
                {
                    detected_name: "Plat détecté",
                    estimated_weight_g: 0,
                    calories: 0
                }
            ],
            total_summary: { 
                calories: "???", 
                proteins: "??", 
                carbs: "??", 
                lipids: "??"
            }
        })
    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: "Erreur lors de la simulation" 
        }, { status: 500 })
    }
}
