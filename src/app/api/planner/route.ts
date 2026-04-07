import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEffectiveTier } from "@/lib/subscription"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 1. Récupérer le profil et le tier
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
    
    const tier = getEffectiveTier(profile)
    
    // Si Free, on ne donne pas accès au planning
    if (tier === 'free') {
        return NextResponse.json({ 
            success: false, 
            error: "Upgrade required", 
            code: "PREMIUM_ONLY" 
        }, { status: 403 })
    }

    // 2. Déterminer le prochain créneau (Next Slot)
    const hour = new Date().getHours()
    let nextSlot = 'collation'
    if (hour >= 5 && hour < 10) nextSlot = 'dejeuner'
    else if (hour >= 10 && hour < 15) nextSlot = 'collation'
    else if (hour >= 15 && hour < 20) nextSlot = 'diner'
    else nextSlot = 'petit_dejeuner'

    // 3. Simuler une proposition depuis la base (en attendant d'avoir la table recipes)
    // Plus tard, on fera une requête SQL ou un appel IA ici.
    const mockProposals: Record<string, any> = {
        'petit_dejeuner': { name: 'Bouillie de mil & une mangue', kcal: 320, protein: 6, carbs: 65, fat: 4 },
        'dejeuner': { name: 'Riz gras au poisson braisé', kcal: 650, protein: 35, carbs: 80, fat: 18 },
        'diner': { name: 'Attiéké thon & crudités', kcal: 480, protein: 28, carbs: 60, fat: 12 },
        'collation': { name: 'Poignée d\'arachides grillées', kcal: 180, protein: 8, carbs: 6, fat: 14 }
    }

    const proposal = mockProposals[nextSlot]

    return NextResponse.json({
        success: true,
        tier,
        next_meal: proposal,
        slot: nextSlot,
        can_see_tomorrow: tier === 'pro' || tier === 'premium',
        can_see_week: tier === 'premium'
    })
}
